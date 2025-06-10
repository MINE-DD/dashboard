from langgraph.graph import StateGraph, START, END, MessagesState
from langchain_ollama import ChatOllama
from langchain_community.chat_models import ChatLlamaCpp
from langchain_core.prompts import ChatPromptTemplate
from langchain_experimental.agents.agent_toolkits import create_csv_agent
from minedd.query import Query
from paperqa.settings import Settings, AgentSettings, ParsingSettings
import multiprocessing

class ChatBackend:
    def __init__(self, model_name: str = 'llama3.2:latest'):
        self.model_name = model_name
        self.llm = ChatOllama(model=model_name, temperature=0.0, max_tokens=512)
        # This calls: https://python.langchain.com/api_reference/_modules/langchain_experimental/agents/agent_toolkits/pandas/base.html#create_pandas_dataframe_agent
        self.csv_agent = create_csv_agent(self.llm, "Plan-EO_Dashboard_point_data.csv", verbose=True, allow_dangerous_code=True)
        self.graph = self.build_graph()
        self.state = {"messages": []} #{"user_input": ""}
    
    def build_graph(self):
        graph = StateGraph(state_schema=MessagesState)

        # Define nodes
        graph.add_node("router", self.router)
        graph.add_node("general_chat", self.general_chat_node)
        graph.add_node("csv_agent", self.csv_agent_node)

        # Define edges
        graph.add_edge(START, "router")
        graph.add_conditional_edges(
            "router",
            lambda state: state["next_node"],
            {
                "general_chat": "general_chat",
                "csv_agent": "csv_agent"
            }
        )
        graph.add_edge("general_chat", END)
        graph.add_edge("csv_agent", END)

        # checkpointer = InMemorySaver()
        compiled_graph = graph.compile()

        return compiled_graph

    def general_chat_node(self, state):
        last_message = state["messages"][-1]
        messages = [
            {"role": "system",
            "content": """You are a purely logical assistant. Focus only on facts and information.
                Provide clear, concise answers based on logic and evidence."""
            },
            {
                "role": "user",
                "content": last_message.content
            }
        ]
        # Input to Invoke Must be a PromptValue, str, or list of BaseMessages
        response = self.llm.invoke(messages)
        return {"messages": response}

    def csv_agent_node(self, state):
        last_message = state["messages"][-1]
        response = self.csv_agent.invoke(last_message)
        # response['input'] has the original question, response['output'] has the answer
        return {"messages": [{"role": "assistant", "content": response['output']}]}
#     }

    def router(self, state):
        last_message = state["messages"][-1].content.lower()
        # Simple routing logic: you can use LLM or regex for more sophistication
        if "csv" in last_message or "data" in last_message:
            return {"next_node": "csv_agent"}
        else:
            return {"next_node": "general_chat"}
    
    def ask(self, question: str):
        self.state["messages"] = self.state.get("messages", []) + [
            {"role": "user", "content": question}
        ]
        final_state = self.graph.invoke(self.state)
        final_response = final_state["messages"][-1].content
        # accumulated_messages = "\n=====\n".join([m.content for m in final_state["messages"]])
        return final_response


class ChatCSV:
    def __init__(self, model_name: str = 'llama3.2:latest'):
        self.model_name = model_name
        self.llm = ChatOllama(model=model_name, temperature=0.0, max_tokens=512)
        self.agent = create_csv_agent(self.llm, "Plan-EO_Dashboard_point_data.csv", verbose=True, allow_dangerous_code=True)
    
    def ask(self, question:str):
        response = self.agent.run(question)
        return response


class ChatSimple:
    def __init__(self, model_name: str):
        self.model_name = model_name
        self.prompt = ChatPromptTemplate.from_template(
            """   
            You are a helpful assistant. Your job is to answer the user's questions based on the provided conversation history.
            Answer as facutal as possible but be friendly. 
            Do not make up an answer. If you don't know the answer, say "I don't know". 
            Don't be too chatty.

            History:
            {chat_history}

            Question: {question}

            Answer:
            """)

        self.llm = ChatLlamaCpp(
            temperature=0.05,
            model_path=model_name,
            n_ctx=512,
            n_batch=128,  # Should be between 1 and n_ctx, consider the amount of VRAM in your GPU.
            max_tokens=512,
            n_threads=multiprocessing.cpu_count() - 1,
            repeat_penalty=1.5,
            top_p=0.5,
            verbose=False,
        )
        self.chain = self.prompt | self.llm
        self.history = []
        

    def ask(self, question: str):
        context = "\n".join(
            f"User: {q}\nAI: {a}" for q, a in self.history
        ) if self.history else "The conversation has just begun."
        response = self.chain.invoke({"question": question, "chat_history": context})
        self.history.append((question, response.text().strip()))
        if len(self.history) > 5:
            self.history.pop(0)
        return response.text().strip()


# TODO: modify the mineDD package to allow for different settings when initializing the Query object
def custom_minedd_settings(model, embedding, papers_directory, chunk_size=2500, overlap=250):
    local_llm_config = {
        "model_list": [
            {
                "model_name": model,
                "litellm_params": {
                    "model": model,
                    # Uncomment if using a local server
                    # "api_base": "http://0.0.0.0:11434",
                },
                "answer": {
                    "evidence_k": 10,
                    "evidence_detailed_citations": True,
                    "evidence_summary_length": "about 100 words",
                    "answer_max_sources": 5,
                    "answer_length": "about 300 words, but can be longer",
                    "max_concurrent_requests": 10,
                    "answer_filter_extra_background": False
                },
                "parsing": {
                    "use_doc_details": True
                },
                "prompts" : {"use_json": False}
            }
        ]
    }

    query_settings = Settings(
        llm=model,
        llm_config=local_llm_config,
        summary_llm=model,
        summary_llm_config=local_llm_config,
        paper_directory=papers_directory,
        embedding=embedding,
        agent=AgentSettings(
            agent_llm=model,
            agent_llm_config=local_llm_config,
            return_paper_metadata=True
        ),
        parsing=ParsingSettings(
            chunk_size=chunk_size,
            overlap=overlap
        ),
        prompts={"use_json": False}
    )

    return query_settings

class MineddBackend:
    def __init__(self, 
                 embeddings_model: str, 
                 model_name: str,
                 papers_directory: str,
                 embeddings_file: str
                 ):
        # Load Query Engine
        self.query_engine = Query(
            model=f"ollama/{model_name}",
            paper_directory=papers_directory,
            output_dir='outputs/',
        )
        self.query_engine.settings = custom_minedd_settings(
            model=f"ollama/{model_name}",
            embedding=f"ollama/{embeddings_model}",
            papers_directory=papers_directory
        )
        self.query_engine.load_embeddings(embeddings_file)

    def ask(self, question: str):
        result = self.query_engine.query_single(question, max_retries=3)
        answer = result['answer']
        return answer.strip()