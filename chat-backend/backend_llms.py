import os
import pandas as pd
from dotenv import load_dotenv
from langgraph.graph import StateGraph, START, END
from langchain_core.prompts import ChatPromptTemplate
from langchain_experimental.agents.agent_toolkits import create_csv_agent, create_pandas_dataframe_agent
### Langchain Chats
from langchain_ollama import ChatOllama
from langchain_google_genai import ChatGoogleGenerativeAI
# from langchain_mistralai import ChatMistralAI
### Other imports
from langgraph.checkpoint.memory import MemorySaver
from typing import Annotated, TypedDict
from langchain_core.messages import HumanMessage, BaseMessage
from langgraph.graph.message import add_messages
from super_csv_agent import SimpleCSVAgent


load_dotenv()
USE_LOCAL_LLM = os.getenv("USE_LOCAL_LLM", "false").lower() == "true"
REMOTE_LLM_NAME = os.getenv("REMOTE_LLM_NAME")

def get_llm_engine():
    if USE_LOCAL_LLM:
        llm = ChatOllama(
            base_url=os.getenv("OLLAMA_BASE_URL"),
            model=os.getenv("LOCAL_LLM_NAME"), 
            temperature=0.0, 
            max_tokens=4096
            )
    elif "mistral" in REMOTE_LLM_NAME.lower():
        # llm = ChatMistralAI(
        #     model=REMOTE_LLM_NAME,
        #     temperature=0.0
        # )
        llm = None
    elif "gemini" in REMOTE_LLM_NAME.lower():
        llm = ChatGoogleGenerativeAI(
            model=REMOTE_LLM_NAME,
            temperature=0,
            max_tokens=None,
            timeout=None,
            max_retries=2
        )
    else:
        raise ValueError(f"Unsupported LLM: {REMOTE_LLM_NAME}. Please set USE_LOCAL_LLM to true or use a supported remote LLM.")
    return llm


def load_and_standardize_dataframe(filename):
    def _extract_float(row):
        try:
            val = row.split()[0]
            return float(val)
        except Exception as e:
            print(f"Error when extracting float from DataFrame column: {e}. Returning None")
            return None
    try:
        planeo_dtypes = {
            'EST_ID':'string', 
            'Pathogen': 'category', 
            'Age_group': 'category', 
            'Syndrome': 'category', 
            'Design': 'category',
            'Site_Location': 'string', 
            'Prevalence': 'string', 
            'Age_range': 'category', 
            'Study': 'string', 
            'Duration': 'string',
            'Source': 'string', 
            'Hyperlink': 'string', 
            'CASES': 'float32', 
            'SAMPLES': 'float32', 
            'PREV': 'float32', 
            'SE': 'float32', 
            'SITE_LAT': 'float32',
            'SITE_LONG': 'float32'
        }
        data = pd.read_csv(filename, dtype=planeo_dtypes)
        data['CASES'] = data['CASES'].fillna(0).astype('int16')
        data['SAMPLES'] = data['SAMPLES'].fillna(0).astype('int16')
        data['Prevalence'] = data['Prevalence'].apply(_extract_float).astype('float32')
    except Exception as e:
        print("WARNING! The Dataframe is not the expected PlanEO format. So no preprocessing is done. Loading CSV file in DataFrame directly...")
        print(e)
        data = pd.read_csv(filename)
    
    return data

class ConversationState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


class ChatBackend:
    """This is meant to be the "global backend", here we can call different 'agents' or 'chains' to handle different types of queries.
    Current functionality:
        - Query for CSV data analysis
        - General chat functionality for non-data queries
    """
    def __init__(self, llm, csv_file:str, use_simple_csv_agent: bool = True):
        self.llm = llm
        self.use_simple_csv_agent = use_simple_csv_agent
        if use_simple_csv_agent:
            self.csv_agent = SimpleCSVAgent(self.llm, csv_file)
        else:
            df = load_and_standardize_dataframe(csv_file)
            self.csv_agent = create_pandas_dataframe_agent(
                self.llm, 
                df, 
                agent_type="zero-shot-react-description",
                verbose=True, 
                allow_dangerous_code=True
                )
        # 
        self.graph = self.build_graph()
        self.state = {"messages": []}
    
    def build_graph(self):
        graph = StateGraph(state_schema=ConversationState)
        
        # Define nodes
        graph.add_node("router", self.context_aware_router)
        graph.add_node("general_chat", self.general_chat_node)
        if self.use_simple_csv_agent:
            graph.add_node("csv_agent", self.simple_csv_agent_node) # This node is for SimpleCSVAgent()
        else:
            graph.add_node("csv_agent", self.default_csv_agent_node) # This node is for the LangChain CSV Agent
        
        # Define edges
        graph.add_edge(START, "router")
        graph.add_conditional_edges(
            "router",
            lambda state: state.get("next_node"),
            {
                "general_chat": "general_chat",
                "csv_agent": "csv_agent"
            }
        )

        graph.add_edge("general_chat", END)
        graph.add_edge("csv_agent", END)

        # Add memory
        memory = MemorySaver()
        compiled_graph = graph.compile(checkpointer=memory)
        return compiled_graph


    def get_chat_history(self, messages, last_k:int):
        last_messages = []
        if last_k <=0:
            return [{ "role": "user", "content": messages[-1].content}]
        for m in messages[-5:]:
            role = "user" if isinstance(m, HumanMessage) else "assistant"
            last_messages.append({"role": role, "content": m.content})
        return last_messages


    def default_csv_agent_node(self, state: ConversationState) -> ConversationState:
        """Enhanced CSV agent that uses reformulated queries with context."""
        
        query_to_use = state["messages"][-1].content
        
        # Create a message object for the CSV agent
        query_message = {"role": "user", "content": query_to_use}
        
        # Invoke CSV agent with the enhanced query
        response = self.csv_agent.invoke(query_message["content"])
        
        return { "messages": [{"role": "assistant", "content": response['output']}]}


    def simple_csv_agent_node(self, state: ConversationState) -> ConversationState:
        query_to_use = state["messages"][-1].content
        # Invoke CSV agent with the direct query (NO HISTORY!)
        response = self.csv_agent.ask(query_to_use)
        return {"messages": [{"role": "assistant", "content": response}]}


    def context_aware_router(self, state: ConversationState) -> str:
        """
        Routes queries based on whether they need context-aware reformulation.
        """
        
        message = state["messages"][-1].content.lower()
        
        if message.lower().startswith("csv:"):
            return {"next_node": "csv_agent"}
        else:
            return {"next_node": "general_chat"}


    async def ask(self, question: str):
        initial_state = {"messages": [{"role": "user", "content": question}]}
        config = {"configurable": {"thread_id": "abc123"}}
        final_state = self.graph.invoke(initial_state, config)
        # Extract response
        response = final_state["messages"][-1].content
        return response


    def general_chat_node(self, state: ConversationState) -> ConversationState:
        print("CHECHEMIL", state["messages"])
        last_messages = self.get_chat_history(state["messages"], last_k=5)
        all_messages = [
            {"role": "system",
            "content": """You are a purely logical assistant. Focus only on facts and information.
                Provide clear, concise answers based on logic and evidence. Only give direct answers."""
            }] + last_messages
        # Input to Invoke Must be a PromptValue, str, or list of BaseMessages
        response = self.llm.invoke(all_messages)
        return {"messages": response}


class ChatCSV:
    def __init__(self, llm, csv_file:str):
        self.llm = llm
        self.agent = create_csv_agent(self.llm, csv_file, verbose=True, allow_dangerous_code=True)
    
    async def ask(self, question:str):
        response = self.agent.run(question)
        return response


class ChatSimple:
    def __init__(self, llm):
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

        self.llm = llm 
        self.chain = self.prompt | self.llm
        self.history = []
        

    async def ask(self, question: str):
        context = "\n".join(
            f"User: {q}\nAI: {a}" for q, a in self.history
        ) if self.history else "The conversation has just begun."
        response = self.chain.invoke({"question": question, "chat_history": context})
        self.history.append((question, response.text().strip()))
        if len(self.history) > 5:
            self.history.pop(0)
        return response.text().strip()