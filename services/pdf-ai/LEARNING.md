# Local correction corpus

Open `http://localhost:3001/vi/assessment/ai-learning` as an administrator. The AI
exam creation page links to this screen.

Saving a changed AI import, editing a saved AI question, or editing its passage /
transcript creates a **pending** correction. The API persists delivery events in
MongoDB (`pdf_ai_correction_events`) and retries every 30 seconds while pdf-ai is
unavailable. An exam save remains successful if corpus delivery fails; capture
failures are returned separately. The learning screen shows queued deliveries.

Compare the before/after labels with the source PDF preview and enter a page /
verification note. Only **Xác nhận đúng** promotes a sample to `gold`. A later edit
starts pending again. Approving a newer revision supersedes the older gold label
for the same job / item. Audio-only and explanation-only changes are not labels.

New imports retain uploaded PDFs by SHA-256 and an immutable initial parser
result. They are stored in `.local/pdf-ai-learning`, outside the media storage
root and Docker build context; no files are uploaded to an external AI service.
Keep this directory and the Mongo database in local backups. Existing jobs can
use a clearly labelled legacy result snapshot; original PDFs for these jobs must
be retained separately before they can be replayed.

## Replay and export

Run from the repository root (PowerShell), after confirming gold labels:

```powershell
docker-compose -f docker-compose.yml -f docker-compose.ai.yml exec -T pdf-ai python learning_cli.py evaluate --output /app/learning/reports/script.json
docker-compose -f docker-compose.yml -f docker-compose.ai.yml exec -T pdf-ai python learning_cli.py export --output /app/learning/exports/current
```

`evaluate` reruns the actual Listening script reader against retained PDFs. It
reports missing questions, mismatched stems / choices, and single-transcript
differences. Exit code 1 means a tested label failed. Unsupported labels are
reported explicitly: Reading crops, layout changes, answer keys and images are
not scored by this first script evaluator. Compare reports after changing the
reader; never replace gold labels with newly generated reader output.

`gold.jsonl`, `train.jsonl`, and `eval.jsonl` contain only confirmed samples with
their provenance. Sources connected by any shared PDF hash stay in the same
partition. Small / connected corpora may have an empty evaluation partition; do
not present those as an independent model benchmark. These are correction
records, not a model-specific training format.

Five Test 7 Part 2 corrections (17, 18, 20, 21, 31) were visually verified against
script PDF pages 5 and 7 and seeded locally. The initial script replay passed
5/5. This is a regression fixture, not an estimate of accuracy on unseen exams.

Test 8 adds six independently transcribed, visually verified script labels:
2, 10, 21, 63, 67 and 73 (PDF pages 1, 3, 5, 18, 19 and 21). The original script
result missed all six. The expanded replay passed 11/11 Test 7 + Test 8 labels;
the full Test 8 reader now recognizes 100 questions and 23 transcript groups.
The alternate gutter/row layout is used only for unresolved questions, retaining
previously accepted scripts. Numeric graphic choices are valid option text.

Test 2 adds question 22 (a distant video badge merged into its number) and
question 97 (clock-time answer choices), visually checked on script PDF pages
5 and 28. The full reader recognizes 100/100 scripts and 23/23 transcript groups.
The expanded Test 2 + Test 7 + Test 8 regression corpus passed 13/13 labels.

Historical Test 6 corrections 22 and 31 were also verified against script PDF
pages 5 and 7 and added as gold. Their original before-fix job snapshot is kept
as a labelled legacy baseline, and the source script PDF is retained privately.
The combined Test 2 + Test 6 + Test 7 + Test 8 script replay passed 15/15 labels.

No weights are trained or changed by collecting, reviewing, replaying, or
exporting corrections. Fine-tuning is a separate later step: first collect more
verified failures, improve the reader, then prepare OCR input / expected output
pairs for the remaining AI failures, with independent source PDFs held out.
