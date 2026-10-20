"""Real HTTP + local-model smoke test; synthetic PDF only, no application database writes."""
import json
import time
import urllib.request
import uuid

import pymupdf


def run(base="http://127.0.0.1:8003"):
    content = """TOEIC PRACTICE TEST
PART 5 - INCOMPLETE SENTENCES
101. The meeting ___ at noon.
(A) starts
(B) start
(C) starting
(D) started
102. Please send the report ___ Friday.
(A) at
(B) by
(C) in
(D) of
PART 7 - READING COMPREHENSION
Questions 147-148 refer to the following notice.
NOTICE: The city library will close on Friday for repairs. It will reopen on Monday.
147. Why will the library close?
(A) A holiday
(B) Staff training
(C) Repairs
(D) A meeting
148. When will the library reopen?
(A) Friday
(B) Saturday
(C) Sunday
(D) Monday
ANSWER KEY
101. A
102. B
147. C
148. D
"""
    with pymupdf.open() as doc:
        page = doc.new_page()
        page.insert_text((40, 40), content, fontsize=11)
        pdf = doc.tobytes()
    boundary = uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="exam_id"\r\n\r\nsmoke\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic.pdf"\r\n'
            'Content-Type: application/pdf\r\n\r\n').encode() + pdf + f'\r\n--{boundary}--\r\n'.encode()
    request = urllib.request.Request(base + "/jobs", data=body,
                                     headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(request, timeout=20) as response:
        job_id = json.load(response)["jobId"]
    print("Submitted synthetic TOEIC PDF:", job_id, flush=True)
    deadline = time.monotonic() + 600
    while time.monotonic() < deadline:
        with urllib.request.urlopen(base + f"/jobs/{job_id}?exam_id=smoke", timeout=10) as response:
            job = json.load(response)
        if job["state"] == "failed":
            raise AssertionError(job["error"])
        if job["state"] == "completed":
            result = job["result"]
            assert result["total"] == 4, result
            assert [p["part"] for p in result["parts"]] == [5, 7], result
            questions = {q["order"]: q for part in result["parts"] for q in part["questions"]}
            for number, answer in ((101, "A"), (102, "B"), (147, "C"), (148, "D")):
                assert questions[number]["correctAnswer"] == answer, questions[number]
                assert len(questions[number]["options"]) == 4, questions[number]
            assert questions[147]["passageGroupTempId"] == questions[148]["passageGroupTempId"]
            assert "library" in result["parts"][1]["groups"][0]["passages"][0]["content"].lower()
            print(json.dumps({"status": "passed", "total": result["total"], "parts": [p["part"] for p in result["parts"]], "model": result["model"]}), flush=True)
            return
        time.sleep(2)
    raise TimeoutError("PDF AI smoke test timed out")


if __name__ == "__main__":
    run()
