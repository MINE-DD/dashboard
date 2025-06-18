from langgraph.graph import StateGraph, START, END
from langchain_ollama import ChatOllama
# from langchain_community.chat_models import ChatLlamaCpp
# from langchain_core.prompts import ChatPromptTemplate
from langchain_experimental.agents.agent_toolkits import create_csv_agent
# from minedd.query import Query
# from paperqa.settings import Settings, AgentSettings, ParsingSettings
# import multiprocessing
from typing import Annotated, TypedDict
from langchain_core.messages import HumanMessage, BaseMessage
from langgraph.graph.message import add_messages

class ConversationState(TypedDict):
    """Enhanced state for context-aware query reformulation."""
    messages: Annotated[list[BaseMessage], add_messages]
    reformulated_query: str
    original_query: str
    context_window: int

class ChatBackend:
    def __init__(self, model_name: str = 'llama3.2:latest', ollama_url:str="http://0.0.0.0:11434"):
        self.model_name = model_name
        self.llm = ChatOllama(
            base_url=ollama_url,
            model=model_name, 
            temperature=0.0, 
            max_tokens=512
            )
        # This calls: https://python.langchain.com/api_reference/_modules/langchain_experimental/agents/agent_toolkits/pandas/base.html#create_pandas_dataframe_agent
        self.csv_agent = create_csv_agent(
            self.llm, 
            "Plan-EO_Dashboard_point_data.csv", 
            agent_type="zero-shot-react-description",
            verbose=True, 
            allow_dangerous_code=True
            )
        self.graph = self.build_graph()
        self.state = {"messages": []}
    
    def build_graph(self):
        graph = StateGraph(state_schema=ConversationState)
        
        # Define nodes
        graph.add_node("router", self.context_aware_router)
        graph.add_node("query_reformulation", self.query_reformulation_node)
        graph.add_node("general_chat", self.general_chat_node)
        graph.add_node("enhanced_csv_agent", self.enhanced_csv_agent_node)
        
        # Define edges
        graph.add_edge(START, "router")
        graph.add_conditional_edges(
            "router",
            lambda state: state.get("next_node"),
            {
                "general_chat": "general_chat",
                "query_reformulation": "query_reformulation"
            }
        )
        
        # After query reformulation, always go to CSV agent
        graph.add_edge("query_reformulation", "enhanced_csv_agent")
        graph.add_edge("general_chat", END)
        graph.add_edge("enhanced_csv_agent", END)
        
        compiled_graph = graph.compile()
        return compiled_graph


    def get_chat_history(self, messages, last_k:int):
        last_messages = []
        if last_k <=0:
            return [{ "role": "user", "content": messages[-1].content}]
        for m in messages[-5:]:
            role = "user" if isinstance(m, HumanMessage) else "assistant"
            last_messages.append({ "role": role, "content": m.content})
        return last_messages


    def query_reformulation_node(self, state: ConversationState, last_n: int = 5) -> ConversationState:
        """
        Reformulates the last question into a pandas query using conversation context.
        
        This node analyzes the last_n messages to understand the full context
        and creates a more precise pandas query for the CSV agent.
        """
        if not state["messages"]:
            return {
                "messages": state["messages"],
                "reformulated_query": "",
                "original_query": "",
                "context_window": 0
            }
        
        # Get the last message (current question)
        current_question = state["messages"][-1].content
        
        # Extract last_n messages for context
        context_messages = state["messages"][-last_n:] if len(state["messages"]) >= last_n else state["messages"]
        
        # Build context string
        context_str = ""
        for i, msg in enumerate(context_messages[:-1]):  # Exclude current question
            role = "user" if isinstance(msg, HumanMessage) else "assistant"
            context_str += f"{role}: {msg.content}\n"
        
        # Create reformulation prompt
        reformulation_prompt = f"""
        You are a data analysis expert. Given the conversation context below and the current question, 
        reformulate the current question into a clear, specific statement that can be mapped into a pandas query.

        Conversation Context (last {len(context_messages)-1} messages):
        {context_str}

        Current Question: {current_question}

        Instructions:
        1. Analyze the conversation flow to understand what data the user is interested in
        2. Consider any previous filters, columns, or analysis mentioned, but give priority to the latest question
        3. Reformulate the current question to be more specific and contextually aware
        4. Focus on creating a query that would work well with pandas operations
        5. If the current question references "that data", "those results", or similar, 
        specify what data based on the context

        Reformulated Query (respond with only the reformulated question):
        """
        
        # Get reformulated query from LLM
        response = self.llm.invoke([{"role": "user", "content": reformulation_prompt}])
        reformulated_query = response.content.strip()
        
        return {
            "messages": state["messages"],
            "reformulated_query": reformulated_query,
            "original_query": current_question,
            "context_window": len(context_messages)
        }

    def enhanced_csv_agent_node(self, state: ConversationState) -> ConversationState:
        """Enhanced CSV agent that uses reformulated queries with context."""
        
        # Use reformulated query if available, otherwise use original
        query_to_use = state.get("reformulated_query", "") or state["messages"][-1].content
        
        # Create a message object for the CSV agent
        query_message = {"role": "user", "content": query_to_use}
        
        # Add context information to help the agent
        context_info = ""
        if state.get("original_query") and state.get("reformulated_query"):
            context_info = f"""
            Original question: {state['original_query']}
            Reformulated with context: {state['reformulated_query']}
            Context window: {state.get('context_window', 0)} messages
            
            Please answer the reformulated question:
            """
            query_message["content"] = context_info + query_to_use
        
        # Invoke CSV agent with the enhanced query
        response = self.csv_agent.invoke(query_message["content"])
        
        return {
            "messages": [{"role": "assistant", "content": response['output']}],
            "reformulated_query": state.get("reformulated_query", ""),
            "original_query": state.get("original_query", ""),
            "context_window": state.get("context_window", 0)
        }


    def context_aware_router(self, state: ConversationState) -> str:
        """
        Routes queries based on whether they need context-aware reformulation.
        """
        
        message = state["messages"][-1].content.lower()
        
        # Keywords that suggest data/CSV queries
        data_keywords = ["csv", "data", "analyze", "chart", "graph", "table", 
                        "statistics", "numbers", "calculate", "sum", "average",
                        "filter", "group", "sort", "count", "mean", "median"]
        
        # Context-dependent phrases that need reformulation
        context_phrases = ["that data", "those results", "the same", "also show",
                        "compared to", "like before", "similar analysis",
                        "from earlier", "previous", "again"]
        
        has_data_intent = any(keyword in message for keyword in data_keywords)
        needs_context = any(phrase in message for phrase in context_phrases)
        
        if has_data_intent or needs_context:
            return {"next_node": "query_reformulation"}
        else:
            return {"next_node": "general_chat"}


    def ask(self, question: str, show_reformulation: bool = False):
        """
        Process question through context-aware reformulation system.
        
        Args:
            question: The user's question
            show_reformulation: Whether to show the reformulated query
        """
        initial_state = {
            "messages": [{"role": "user", "content": question}],
            "reformulated_query": "",
            "original_query": "",
            "context_window": 0
        }
        
        final_state = self.graph.invoke(initial_state)
        
        # Extract response
        response = final_state["messages"][-1].content
        
        # Show reformulation details if requested
        if show_reformulation and final_state.get("reformulated_query"):
            print(f"Original: {final_state.get('original_query', 'N/A')}")
            print(f"Reformulated: {final_state.get('reformulated_query', 'N/A')}")
            print(f"Context window: {final_state.get('context_window', 0)} messages")
            print("-" * 50)
        
        return response


    def general_chat_node(self, state: ConversationState) -> ConversationState:
        last_messages = self.get_chat_history(state["messages"], last_k=5)
        messages = [
            {"role": "system",
            "content": """You are a purely logical assistant. Focus only on facts and information.
                Provide clear, concise answers based on logic and evidence."""
            }] + last_messages
        # Input to Invoke Must be a PromptValue, str, or list of BaseMessages
        response = self.llm.invoke(messages)
        return {"messages": response}


class ChatCSV:
    def __init__(self, model_name: str = 'llama3.2:latest'):
        self.model_name = model_name
        self.llm = ChatOllama(model=model_name, temperature=0.0, max_tokens=512)
        self.agent = create_csv_agent(self.llm, "Plan-EO_Dashboard_point_data.csv", verbose=True, allow_dangerous_code=True)
    
    def ask(self, question:str):
        response = self.agent.run(question)
        return response


# class ChatSimple:
#     def __init__(self, model_name: str):
#         self.model_name = model_name
#         self.prompt = ChatPromptTemplate.from_template(
#             """   
#             You are a helpful assistant. Your job is to answer the user's questions based on the provided conversation history.
#             Answer as facutal as possible but be friendly. 
#             Do not make up an answer. If you don't know the answer, say "I don't know". 
#             Don't be too chatty.

#             History:
#             {chat_history}

#             Question: {question}

#             Answer:
#             """)

#         self.llm = ChatLlamaCpp(
#             temperature=0.05,
#             model_path=model_name,
#             n_ctx=512,
#             n_batch=128,  # Should be between 1 and n_ctx, consider the amount of VRAM in your GPU.
#             max_tokens=512,
#             n_threads=multiprocessing.cpu_count() - 1,
#             repeat_penalty=1.5,
#             top_p=0.5,
#             verbose=False,
#         )
#         self.chain = self.prompt | self.llm
#         self.history = []
        

#     def ask(self, question: str):
#         context = "\n".join(
#             f"User: {q}\nAI: {a}" for q, a in self.history
#         ) if self.history else "The conversation has just begun."
#         response = self.chain.invoke({"question": question, "chat_history": context})
#         self.history.append((question, response.text().strip()))
#         if len(self.history) > 5:
#             self.history.pop(0)
#         return response.text().strip()


# # TODO: modify the mineDD package to allow for different settings when initializing the Query object
# def custom_minedd_settings(model, embedding, papers_directory, chunk_size=2500, overlap=250):
#     local_llm_config = {
#         "model_list": [
#             {
#                 "model_name": model,
#                 "litellm_params": {
#                     "model": model,
#                     # Uncomment if using a local server
#                     # "api_base": "http://0.0.0.0:11434",
#                 },
#                 "answer": {
#                     "evidence_k": 10,
#                     "evidence_detailed_citations": True,
#                     "evidence_summary_length": "about 100 words",
#                     "answer_max_sources": 5,
#                     "answer_length": "about 300 words, but can be longer",
#                     "max_concurrent_requests": 10,
#                     "answer_filter_extra_background": False
#                 },
#                 "parsing": {
#                     "use_doc_details": True
#                 },
#                 "prompts" : {"use_json": False}
#             }
#         ]
#     }

#     query_settings = Settings(
#         llm=model,
#         llm_config=local_llm_config,
#         summary_llm=model,
#         summary_llm_config=local_llm_config,
#         paper_directory=papers_directory,
#         embedding=embedding,
#         agent=AgentSettings(
#             agent_llm=model,
#             agent_llm_config=local_llm_config,
#             return_paper_metadata=True
#         ),
#         parsing=ParsingSettings(
#             chunk_size=chunk_size,
#             overlap=overlap
#         ),
#         prompts={"use_json": False}
#     )

#     return query_settings

# class MineddBackend:
#     def __init__(self, 
#                  embeddings_model: str, 
#                  model_name: str,
#                  papers_directory: str,
#                  embeddings_file: str
#                  ):
#         # Load Query Engine
#         self.query_engine = Query(
#             model=f"ollama/{model_name}",
#             paper_directory=papers_directory,
#             output_dir='outputs/',
#         )
#         self.query_engine.settings = custom_minedd_settings(
#             model=f"ollama/{model_name}",
#             embedding=f"ollama/{embeddings_model}",
#             papers_directory=papers_directory
#         )
#         self.query_engine.load_embeddings(embeddings_file)

#     def ask(self, question: str):
#         result = self.query_engine.query_single(question, max_retries=3)
#         answer = result['answer']
#         return answer.strip()