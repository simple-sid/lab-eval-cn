# Evaluation System Updates

## Changes Implemented

- **`/docker/dockerManager.js`**
  - Updated `HostConfig` to allow evaluation scripts to run inside the container.

- **`/controllers/sshController.js`**
  - **`runEvaluation`**
    - Moves evaluation scripts to the container during evaluation.
    - Runs the scripts inside the container.
    - Retrieves the output.
    - Returns an object containing **three CSV strings**:
      - `evaluation`
      - `connection`
      - `status`
    - Currently takes one server and one client file — needs to be updated to handle an array of files or a compatible structure.

- **`/controllers/evaluationController.js`**
  - **`processEvaluationResults`**
    - Accepts the object returned by `runEvaluation`.
    - Currently only processes the **`evaluated.csv`** content.
    - Saves the evaluation result in the database.
    - Sets the **best submission** flag if the score is the highest.
  - **`calculateScore`**
    - Function to be implemented by **teacher**.

- **`/models/Submission.js`**
  - Updated `submissionSchema`.


## API Endpoints `/routes/submission.js`

### **Student**
- `POST /evaluate/:studentId`  
  Evaluates and returns the result.

- `GET /student-submissions/:studentId`  
  Fetches **all submissions** made by a student during the **current session** (not just the latest one).

### **Teacher**
- `GET /best-submissions`  
  Returns all **best submissions** grouped by student for **dashboard display**.

- `GET /export-best-csv`  
  Returns a **CSV file** of all best submissions for **download/report**.


- **`/Dockerfile`** 
  - **added these**
    - libpcap-dev \
    - libcap2-bin \
  - Earlier changes I (siddhesh) made are now commented under **changes made earlier** as they caused conflicts. You can use or delete them as you see fit.


### NOTE : None of the evaluation scripts(tcpdump) have been included in this push