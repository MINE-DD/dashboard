# %pip install streamlit

import streamlit as st
import pandas as pd
import os

# File paths
CSV_FILE = "outputs/planeo_data_qa_with_answers.tsv"
RESULT_FILE = "outputs/evaluated_answers.tsv"

def main_qa_eval():
    # Validate CSV exists
    if not os.path.exists(CSV_FILE):
        st.error(f"CSV file '{CSV_FILE}' not found.")
        st.stop()

    # Load data
    if os.path.exists(RESULT_FILE):
        df = pd.read_csv(RESULT_FILE, sep="\t")
        st.info(f"Loaded progress from {RESULT_FILE}")
    else:
        df = pd.read_csv(CSV_FILE, sep="\t")
        if 'manual_evaluation' not in df.columns:
            df['manual_evaluation'] = "-"
        st.info(f"Loaded fresh data from {CSV_FILE}")


    # Add a classification column if not present
    if 'manual_evaluation' not in df.columns:
        df['manual_evaluation'] = "-"

    # Find the first unanswered question
    unanswered = df[df['manual_evaluation'] == "-"]
    if unanswered.empty:
        st.success("All questions have been classified!")
        st.dataframe(df)
    else:
        idx = unanswered.index[0]
        row = df.loc[idx]

        st.write(f"**Question:** {row['question']}")
        st.write(f"**Right Answer:** {row['answer']}")
        st.write(f"**Model Answer:** {row['llm_response']}")

        classification = st.radio(
            "Classify the model answer:",
            ("correct", "incorrect", "timeout")
        )

        if st.button("Save classification"):
            df.at[idx, 'manual_evaluation'] = classification
            df.to_csv(RESULT_FILE, index=False, sep="\t")
            st.success(f"Saved as '{classification}'. Move to next question.")
            st.rerun()  # Refresh to show next question    

        st.write(f"Progress: {len(df) - len(unanswered) + 1} / {len(df)}")
    
    if st.button("Exit App"):
        st.session_state['exit'] = True

## Handle Graceful Exit 
if 'exit' not in st.session_state:
    st.session_state['exit'] = False

if st.session_state['exit']:
    st.success("Thank you! You may now close this tab or window.")
    st.stop()
else:
    main_qa_eval()