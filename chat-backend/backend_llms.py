import os
import pandas as pd
from dotenv import load_dotenv
from enum import Enum
from typing import Annotated, TypedDict
### Langchain Chats
# import torch
# from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
# from langchain_huggingface.llms import HuggingFacePipeline
from langchain_ollama import ChatOllama
from langchain_google_genai import ChatGoogleGenerativeAI
### Other imports
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, BaseMessage
from langchain_experimental.agents.agent_toolkits import create_csv_agent, create_pandas_dataframe_agent
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver

from super_csv_agent import SimpleCSVAgent

load_dotenv()

class LLMProvider(Enum):
    "Model providers try to be compatible with the langchain.chat_models.base.init_chat_model() method"
    OLLAMA = "ollama"
    GEMINI = "google_genai"

def get_llm_engine(config: dict):
    ### Extract Model Values
    model_fullname = config.get('llm_gen_default')
    if model_fullname is None:
        raise ValueError("Check that config-chat.json has a populated 'llm_gen_default' field!")
    model_provider = model_fullname.split("/")[0]
    model_name = "/".join(model_fullname.split("/")[1:])

    if model_provider not in [member.value for member in LLMProvider]:
        raise ValueError(
            f"Invalid '{model_provider}' in the 'llm_gen_default' field in config.json. "
            f"Allowed provider values are: {[member.value for member in LLMProvider]}"
            "Double check that the modelname also exists for the given provider"
        )
    llm = None
    if model_provider == LLMProvider.OLLAMA.value:
        llm = ChatOllama(
            base_url=os.getenv("OLLAMA_BASE_URL"),
            model=model_name, 
            temperature=0.0, 
            max_tokens=4096
            )
    elif model_provider == LLMProvider.GEMINI.value:
        llm = ChatGoogleGenerativeAI(
            model=model_name,
            temperature=0,
            max_tokens=None,
            timeout=None,
            max_retries=2
        )
    else:
        raise ValueError(f"Unsupported LLM: {model_name}. Please make sure the 'llm_gen_default' field is in the form 'model_provider/model_name' where model_name is supported by the LLM provider.")
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
        df = self._validate_csv(csv_file)
        if use_simple_csv_agent:
            self.csv_agent = SimpleCSVAgent(self.llm, csv_file)
        else:
            self.csv_agent = create_pandas_dataframe_agent(
                self.llm, 
                df, 
                agent_type="zero-shot-react-description",
                verbose=True, 
                allow_dangerous_code=True
                )
        self.graph = self.build_graph()
        self.state = {"messages": []}
    
    def _validate_csv(self, csv_path):
        if csv_path is None:
            raise ValueError("The CSV path in the config-chat.json is not valid. The file must contain a 'csv_datafile' key with a valid filepath")
        try:
            df = load_and_standardize_dataframe(csv_path)
        except Exception as e:
            raise ValueError(f"ERROR {e}! The CSV filename {csv_path} could not be loaded as a DataFrame.")
        return df

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
        for m in messages[-last_k:]:
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