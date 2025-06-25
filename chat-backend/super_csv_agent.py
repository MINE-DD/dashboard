import pandas as pd
from langchain_ollama import ChatOllama
from langchain.agents import Tool, AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate
import io
import time
from contextlib import redirect_stdout, redirect_stderr

class SimpleCSVAgent:
    def __init__(self, llm: ChatOllama, csv_path: str):
        self.csv_path = csv_path
        self.df = pd.read_csv(csv_path)
        self.llm = llm
    
    def ask(self, query: str) -> str:
        """
        Single method that performs all 3 steps:
        1. Translate human query into Python code (focus on the question, ignore extra comments)
        2. Execute the Python code
        3. Return only the answer
        """
        
        # Step 1: Translate human query into Python code
        python_code = self._translate_to_code(query)
        
        # Step 2: Execute the Python code
        result = self._execute_code(python_code)
        
        # Step 3: Return the answer
        return result
    
    def _translate_to_code(self, query: str) -> str:
        """Step 1: Generate Python pandas code from natural language query"""
        
        # Get DataFrame context
        df_info = f"""
        DataFrame shape: {self.df.shape}
        Columns: {list(self.df.columns)}
        Data types: {self.df.dtypes.to_dict()}
        Sample data:
        {self.df.head(10).to_string()}
        """
        
        prompt = f"""
        Given this DataFrame information:
        {df_info}
        
        Convert this human query into Python pandas code: "{query}"
        
        Requirements:
        - Use 'df' as the DataFrame variable name
        - Write only the Python code that answers the question
        - Make sure the code returns the final result as a string
        - Do not include any explanations or markdown formatting
        
        Python code:
        """
        
        response = self.llm.invoke(prompt)
        generated_code = response.content.strip()
        
        # Clean up any markdown formatting
        if "```python" in generated_code:
            generated_code = generated_code.split("```python")[1].lstrip()
            if "```" in generated_code:
                generated_code = generated_code.split("```")[0].strip()
        
        return generated_code
    
    def _execute_code(self, code: str) -> str:
        """Step 2: Execute the generated Python code and return result"""
        
        try:
            # Create execution environment
            local_namespace = {
                'df': self.df.copy(),
                'pd': pd,
                'numpy': __import__('numpy'),
                'np': __import__('numpy')
            }
            
            # Capture output
            output_buffer = io.StringIO()
            error_buffer = io.StringIO()
            
            with redirect_stdout(output_buffer), redirect_stderr(error_buffer):
                # Execute the code
                exec(code, {"__builtins__": __builtins__}, local_namespace)
            
            # Check for errors
            stderr_output = error_buffer.getvalue()
            if stderr_output:
                return f"Error: {stderr_output}"
            
            # Get output
            stdout_output = output_buffer.getvalue()
            if stdout_output:
                return stdout_output.strip()
            
            # If no print output, evaluate the last expression
            try:
                lines = code.strip().split('\n')
                last_line = lines[-1].strip()
                if not any(last_line.startswith(cmd) for cmd in ['print', 'df.to_', 'plt.']):
                    result = eval(last_line, {"__builtins__": __builtins__}, local_namespace)
                    return str(result)
            except Exception:
                pass
            
            return "Code executed successfully (no output)"
            
        except Exception as e:
            return f"Execution error: {str(e)}"


class CSVCodeReactAgent:
    def __init__(self, llm: ChatOllama, csv_path: str):
        self.csv_path = csv_path
        self.df = pd.read_csv(csv_path)
        self.llm = llm
        
        # Create tools
        self.tools = [
            Tool(
                name="generate_and_execute_pandas_code",
                func=self.generate_and_execute_code,
                description="""
                Generate and execute Python pandas code to answer questions about the CSV data.
                Input should be a natural language question about the data.
                The CSV is already loaded as 'df' variable.
                """
            ),
            Tool(
                name="show_dataframe_info",
                func=self.show_df_info,
                description="Show basic information about the loaded DataFrame including columns, shape, and data types."
            )
        ]
        
        # Create the agent
        self.agent = self._create_agent()
    
    def generate_and_execute_code(self, question: str) -> str:
        """Generate Python pandas code based on the question and execute it"""
        
        # Get DataFrame info for context
        df_info = f"""
        DataFrame shape: {self.df.shape}
        Columns: {list(self.df.columns)}
        Data types: {self.df.dtypes.to_dict()}
        First few rows:
        {self.df.head().to_string()}
        """
        
        # Create a prompt for code generation
        code_prompt = f"""
        You are a Python pandas expert. Given the following DataFrame information and user question, 
        generate Python code that answers the question.
        
        DataFrame Info:
        {df_info}
        
        User Question: {question}
        
        Requirements:
        - Use only pandas operations
        - Break the question into simpler steps until you arrive to the final answer
        - The DataFrame is available as 'df'
        - Return only the Python code, no explanations
        - Make sure the code prints or returns the final result as a statement
        - Handle potential errors gracefully
        
        Python Code:
        """
        
        # Generate code using LLM
        response = self.llm.invoke(code_prompt)
        generated_code = response.content.strip()
        
        # Clean up the code (remove markdown formatting if present)
        if "```python" in generated_code:
            generated_code = generated_code.split("```python")[1].lstrip()
            if "```" in generated_code:
                generated_code = generated_code.split("```")[0].strip()
        
        # Execute the code
        return self._execute_code(generated_code)
    
    def _execute_code(self, code: str) -> str:
        """Safely execute the generated Python code"""
        try:
            # Create a local namespace with the DataFrame
            local_namespace = {
                'df': self.df.copy(),
                'pd': pd,
                'numpy': __import__('numpy'),
                'np': __import__('numpy')
            }
            
            # Capture output
            output_buffer = io.StringIO()
            error_buffer = io.StringIO()
            
            with redirect_stdout(output_buffer), redirect_stderr(error_buffer):
                exec(code, {"__builtins__": __builtins__}, local_namespace)
            
            # Get the output
            stdout_output = output_buffer.getvalue()
            stderr_output = error_buffer.getvalue()
            
            if stderr_output:
                return f"Error executing code:\n{stderr_output}"
            
            if stdout_output:
                return f"Code executed successfully:\n{stdout_output}"
            else:
                # If no print output, try to get the last expression result
                lines = code.strip().split('\n')
                last_line = lines[-1].strip()
                if not last_line.startswith(('print', 'df.to_', 'plt.')):
                    try:
                        result = eval(last_line, {"__builtins__": __builtins__}, local_namespace)
                        return f"Result: {result}"
                    except:
                        return "Code executed successfully (no output)"
                
                return "Code executed successfully (no output)"
                
        except Exception as e:
            return f"Error executing code: {str(e)}"
    
    def show_df_info(self, _: str = "") -> str:
        """Show basic information about the DataFrame"""
        info_str = f"""
        DataFrame Information:
        - Shape: {self.df.shape}
        - Columns: {list(self.df.columns)}
        - Data Types:
        {self.df.dtypes.to_string()}
        
        First 5 rows:
        {self.df.head().to_string()}
        
        Basic Statistics:
        {self.df.describe().to_string()}
        """
        return info_str
    
    def _create_agent(self):
        """Create the ReAct agent"""
        prompt_template = """
        You are a data analysis assistant that can generate and execute Python pandas code.
        You have access to a CSV file loaded as a pandas DataFrame.
        
        Answer the user's question by using the available tools to generate and execute appropriate pandas code.
        
        Available tools:
        {tools}
        
        Use the following format:
        
        Question: the input question you must answer
        Thought: you should always think about what to do
        Action: the action to take, should be one of [{tool_names}]
        Action Input: the input to the action
        Observation: the result of the action
        ... (this Thought/Action/Action Input/Observation can repeat N times)
        Thought: I now know the final answer
        Final Answer: the final answer to the original input question
        
        Question: {input}
        Thought: {agent_scratchpad}
        """
        
        prompt = PromptTemplate.from_template(prompt_template)
        
        agent = create_react_agent(
            llm=self.llm,
            tools=self.tools,
            prompt=prompt
        )
        
        return AgentExecutor(
            agent=agent,
            tools=self.tools,
            verbose=True,
            handle_parsing_errors=True
        )
    
    def ask(self, question: str) -> str:
        """Ask a question about the CSV data"""
        try:
            result = self.agent.invoke({"input": question})
            return result["output"]
        except Exception as e:
            return f"Error processing question: {str(e)}"


# Usage example
def main_example(save_output=True):
    # Init LLM
    llm = ChatOllama(
            #base_url=ollama_url,
            model="llama3.2:latest", 
            temperature=0.0, 
            max_tokens=512
            )
    # Initialize the agent
    csv_agent = SimpleCSVAgent(llm, csv_path="chat-backend/Plan-EO_Dashboard_point_data.csv")
    
    # Ask questions
    questions = [
        "How many records are there?",
        "How many pathogens are there?",
        "Please name each of the pathogens available in the dataset",
        "In which location are there more studies about Rotavirus?",
        "What Syndromes are included in the data?"
    ]
    
    total_start_time = time.time()
    outputs = []
    for question in questions:
        start_time = time.time()
        print(f"\nQuestion: {question}")
        print("=" * 50)
        answer = csv_agent.ask(question)
        print(f"Answer: {answer}")
        print("\n")
        end_time = time.time()  # End timing for this question
        elapsed_time = end_time - start_time
        print(f"⏱️ Time: {elapsed_time:.4f} seconds")
        if save_output:
            outputs.append((question, answer, elapsed_time))
    

    total_end_time = time.time()
    total_elapsed_time = total_end_time - total_start_time
    
    print(f"\n🏁 Total execution time: {total_elapsed_time:.4f} seconds")
    print(f"📊 Average time per question: {total_elapsed_time/len(questions):.4f} seconds")
    return outputs

def planeo_evaluate(outputs):
    gold_answers = [
        5702,
        17,
        ["Adenovirus 40/41", "Campylobacter spp.", "Cryptosporidium spp.", "Entamoeba histolytica", "Enterotoxigenic E. coli (ETEC)", "Giardia spp.", "Norovirus GI/GII", "Rotavirus", "Salmonella spp.", "Shigella spp.", "Shiga toxin-producing E. coli (STEC)", "Vibrio cholerae", "Sapovirus", "Astrovirus", "Cyclospora cayetanensis", "Enteroaggregative E. coli (EAEC)", "Enteropathogenic E. coli (EPEC)"],
        "The location with the most studies about Rotavirus is Location A.",
        ["Medically attended diarrhea - inpatient", "Asymptomatic", "Community detected diarrhea", "Medically attended diarrhea - outpatient"]
    ]
    assert len(outputs) == len(gold_answers), "Number of outputs does not match number of gold answers"
    scores = []
    for i, (output, gold) in enumerate(zip(outputs, gold_answers)):
        question, answer, elapsed_time = output
        if gold in answer:
            print(f"✅ Question {i+1} passed: {question}")
            scores.append(1)
        else:
            print(f"❌ Question {i+1} failed: {question}")
            scores.append(0)
    
    print(f"\nTotal Accuracy: {sum(scores)}/{len(scores)}")

# Comment to only use the agent as a module
if __name__ == "__main__":
    main_example()