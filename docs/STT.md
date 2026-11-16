# STT tiếng Việt tách từ P-018

## Chạy thử ngay

```powershell
cd C:\Users\LAPTOP\Documents\Projects\speech-to-navigation
npm run stt:start
```

Mở [http://localhost:3000/stt](http://localhost:3000/stt), đợi “Model sẵn sàng”, bấm “Bắt đầu phiên micro” và nói tiếng Việt. Văn bản xuất hiện dần ngay trong lúc thu; bấm “Kết thúc phiên” để dừng micro và nhận nốt các đoạn đang chờ. Có thể tải file mẫu `models/stt/zipformer-vi/test_wavs/1.wav`; kết quả đã kiểm chứng: **“những nơi đã khống chế được căn bệnh”**.

Model được nạp vào RAM ở lượt đầu và dùng lại cho các lượt sau. Đóng tab không tự dừng các dịch vụ nền. Log và PID của từng dịch vụ ở `logs/stt-backend.*` và `logs/stt-web.*`; có thể dùng Task Manager để dừng đúng tiến trình theo PID hiện tại sau khi kiểm tra tên tiến trình. Lệnh khởi động không đăng ký tự chạy khi Windows khởi động lại.

Trên máy mới, chạy `npm run stt:setup` trước. Python 3.12 64-bit đã được kiểm chứng trên Windows ở máy này. Gói thư viện STT hiện tại không dùng PyTorch/CUDA. Tổng 5 file STT khoảng 77 MB; model segmentation và speaker embedding bổ sung khoảng 46 MB; môi trường Python và npm chiếm dung lượng riêng, được git-ignore.

## Nguồn và phạm vi sao chép

Nguồn local: `C:\Users\LAPTOP\Documents\Projects\P-018-source\P-018`.

| Nguồn P-018 | Đích | Điều chỉnh |
|---|---|---|
| `backend/src/services/voice/stt.py` | `stt/stt.py` | Giữ ZipformerAdapter và xuất BPE vocabulary; đổi import; bỏ các DTO giao tiếp worker không cần thiết |
| `backend/src/services/voice/audio.py` | `stt/audio.py` | Giữ chuẩn WAV PCM16 mono 16 kHz và energy gate; đổi import |
| `backend/src/services/voice/stt_hotwords.py` | `stt/hotwords.py` | Giữ chuẩn hóa NFC/uppercase và encoding; bỏ toàn bộ hotwords điều khiển xe/tin nhắn |
| `frontend/src/features/voice/audio-input.ts` | `lib/stt/microphone.ts` | Giữ AudioWorklet thu PCM liên tục; bỏ ring buffer, wake word và lease chia sẻ micro |
| `frontend/src/features/voice/audio.ts` | `lib/stt/audio.ts` | Giữ downmix/resample/PCM16/WAV; hỗ trợ MIME file âm thanh phổ biến; không giới hạn thời lượng |
| `backend/tests/test_voice/test_audio.py` | `stt/tests/test_audio.py` | Giữ test gốc, đổi import |
| `models/manifest.json` (entry `stt`) | `stt/model_artifacts.py` | Giữ nguyên model ID, revision và 5 tên artifact; bỏ các model khác |
| `LICENSE` | `stt/LICENSE.P-018` | Giữ MIT notice của source |

`stt/contracts.py` và `stt/errors.py` chỉ giữ kết quả và lỗi cần cho STT. API, engine local, downloader, CLI smoke, UI thử nghiệm, proxy Next.js và script chạy là phần tích hợp mới. Không sao chép backend tổng, database, authentication, simulator, messaging, TTS, LLM, wake word hay logic định tuyến lệnh.

Model: `csukuangfj/sherpa-onnx-zipformer-vi-int8-2025-04-20`.

Revision giữ nguyên từ P-018: `b2745a435379992ad3f299635468db0c34918e1e`.

P-018 khai báo giấy phép model Apache-2.0 trong manifest. Trọng số được tải vào `models/stt/zipformer-vi/` và bỏ qua bởi Git. `provision.json` ghi model ID, revision và SHA-256 lúc tải. Downloader chỉ chạy khi setup; các request nhận dạng không tự tải model.

## Luồng và API

Trình duyệt thu PCM liên tục bằng AudioWorklet hoặc đọc file → xử lý âm thanh P-018 → WAV mono 16 kHz PCM16 → `POST /api/stt` trong Next.js → `POST /transcribe` ở FastAPI → Zipformer CPU → transcript chữ thường NFC.

| Endpoint | Mục đích |
|---|---|
| `GET /api/stt` | Proxy trạng thái model và backend |
| `POST /api/stt` | Nhận raw WAV với `Content-Type: audio/wav`, trả JSON |
| `GET http://127.0.0.1:8765/health` | Trạng thái artifact, revision, model đã nạp hay chưa |
| `POST http://127.0.0.1:8765/transcribe` | Cùng hợp đồng WAV, dùng khi kiểm tra backend trực tiếp |

Kết quả STT cơ bản gồm `transcript`, `language`, `model_id`, `configured_revision`, `resolved_revision`, `inference_ms`, `audio_ms`, `no_speech`. Model không cung cấp confidence nên `confidence=null`. Không tự thay bằng Web Speech hoặc transcript giả.

Phiên micro không giới hạn tổng thời gian. Bộ chia đoạn không mở lại micro giữa các đoạn, không chờ bấm dừng: gửi tại khoảng nghỉ khoảng 600ms sau ít nhất 1 giây âm thanh, hoặc bắt buộc mỗi 5 giây. Kết quả nối theo thứ tự về ngay trong lúc thu. Backend không giới hạn dung lượng/thời lượng WAV; chỉ xử lý một lượt suy luận đồng thời. Lượt gửi khi đang bận trả `429/STT_BUSY`. WAV sai chuẩn trả `400`, thiếu model/lỗi suy luận trả `503`. Đoạn không phát hiện lời nói trả kết quả rỗng `no_speech=true`; WAV hoàn toàn bằng zero trả `400/AUDIO_SILENT`. Silero VAD chọn các khoảng lời nói trước nhận dạng; xem cấu hình ở cuối tài liệu.

Backend mặc định chỉ bind loopback. Có thể đặt `STT_BACKEND_URL` trong `.env.local` nếu tự chạy backend cổng khác; Next.js cần khởi động lại sau khi đổi. Có thể dùng `-WebPort 3001 -SttPort 8766` với `scripts/start-stt.ps1` nếu cổng mặc định đã bị chiếm.

## Chạy thủ công và kiểm tra

Nếu muốn quản lý dịch vụ bằng terminal thay vì chạy nền:

```powershell
# Terminal 1 (Ctrl+C để dừng)
.\.venv-stt\Scripts\python.exe -m uvicorn stt.api:app --host 127.0.0.1 --port 8765

# Terminal 2 (Ctrl+C để dừng)
npm run dev
```

```powershell
# Test tự động backend và frontend/proxy
.\.venv-stt\Scripts\python.exe -m pytest stt/tests -q
npm test
npm run lint
npm run build

# Chạy model thật trên 3 file WAV upstream
.\.venv-stt\Scripts\python.exe -m stt.smoke

# Hoặc WAV của bạn (CLI tự đổi sample rate / mono)
.\.venv-stt\Scripts\python.exe -m stt.smoke C:\path\sample.wav
```

Các giới hạn và kết quả đã kiểm tra được ghi ở [STT-VERIFICATION.md](STT-VERIFICATION.md). Kết quả trả dần theo đoạn, chưa phải từng từ/từng token. Độ trễ thông thường gồm thời gian tích lũy đoạn (khoảng 1–5 giây), thời gian chờ và suy luận; không cam kết một độ trễ cố định. Cắt bắt buộc ở 5 giây có thể làm giảm chính xác từ nằm ở ranh giới. Đã có lớp sửa text tạm thời và gắn timestamp/người nói; chưa gắn vào nút micro của màn hình điền bệnh án cũ. Độ chính xác trên giọng thực tế/thuật ngữ y tế cần bạn đánh giá thêm.


## Thêm thuật ngữ chuyên ngành

Sửa `config/stt-hotwords.json`, ví dụ:

```json
{
  "phrases": [
    "tai mũi họng",
    "viêm xoang hàm",
    "nội soi thanh quản",
    "amoxicillin",
    "clavulanate"
  ]
}
```

Lưu file; đoạn nhận dạng tiếp theo dùng danh sách mới, không cần khởi động lại. File mặc định để rỗng để tránh thiên lệch thuật ngữ khi chưa biết chuyên khoa. Hỗ trợ tối đa 200 cụm, mỗi cụm tối đa 120 ký tự; không chứa `/`, `:`, xuống dòng hoặc ký tự NUL. Chuẩn hóa NFC và bỏ cụm trùng. JSON không hợp lệ báo `STT_HOTWORDS_INVALID`; không âm thầm bỏ qua.

Đây là **contextual biasing** trong decoder modified beam search, score 1.5, không cập nhật trọng số. Hotwords giúp ưu tiên cụm phù hợp với âm thanh, không bảo đảm viết đúng tên thuốc tiếng nước ngoài, không thêm kiến thức y khoa và không sửa có kiểm soát mọi dạng phát âm. Danh sách quá rộng có thể làm giảm độ chính xác. Cần thử bằng giọng và thuật ngữ thực tế. [Tài liệu hotwords chính thức](https://k2-fsa.github.io/sherpa/onnx/hotwords/index.html).

Nếu muốn fine-tune thật sự, cần dữ liệu âm thanh và transcript đã được duyệt, pipeline huấn luyện phù hợp kiến trúc Zipformer, rồi xuất model ONNX mới. Bản INT8 hiện tại là artifact suy luận; không thể “dạy thêm” chỉ bằng cách sửa file trọng số.

## Hai người nói và ghép lượt nói qua ranh giới đoạn

Đã tích hợp **pyannote segmentation 3.0 ONNX + NeMo TitaNet-Small speaker embeddings**, chạy CPU qua sherpa-onnx. Mỗi phiên có tối đa hai đặc trưng giọng trong RAM. Cluster cục bộ được khớp với đặc trưng phiên để nhãn Người nói 1/2 giữ ổn định khi cửa sổ âm thanh thay đổi. Các giọng không đủ bằng chứng, giọng bổ sung hoặc vùng nói chồng được đánh dấu chưa rõ/nói chồng.

Âm thanh vẫn gửi tối đa mỗi 5 giây. Backend giữ cửa sổ tối đa 25 giây và nhận dạng lại bằng Zipformer có timestamp token. Token BPE được ghép thành từ, rồi đối chiếu với khoảng giọng nói. Khoảng 10 giây cuối là **text tạm thời có thể sửa**, thay vì nối mù từng chuỗi text. Khi giọng A nói 8 giây và âm thanh gửi thành 5+3, lần sau nhận dạng lại đủ 8 giây để sửa từ bị cắt ngang; giao diện thay phần tạm và ghép từ của A thành một lượt nói liên tục. Không dùng LLM viết lại, thêm nội dung hay tạo dấu câu tự động.

Phần text đã chốt không bị thay thế chỉ vì timestamp mới dao động vài chục mili giây. Bộ đối chiếu dùng cả chuỗi từ và thời gian quanh mốc chốt, giữ được các từ lặp có chủ đích. Lượt A/B/A vẫn là ba lượt riêng, không gom mọi lời của A thành một khối xuyên qua lời của B.

Mốc thời gian của Zipformer là **ước lượng phát token**, chưa phải forced alignment từng âm vị. Không có cam kết gắn giọng/từ chính xác tuyệt đối, nhất là lời rất ngắn, đổi giọng nhanh, nhiễu hoặc nói chồng; âm thanh nói chồng chưa được tách nguồn để khôi phục độc lập hai câu. Nhãn 1/2 là giọng xuất hiện trong phiên, không xác định danh tính hoặc vai bác sĩ/bệnh nhân.

### Cài model, nguồn và kiểm tra

`npm run stt:setup` tải cả STT và diarization. Nếu đã có môi trường STT:

```powershell
.\.venv-stt\Scripts\python.exe -m stt.download_diarization
.\.venv-stt\Scripts\python.exe -m stt.diarization_smoke
```

Model lấy từ release chính thức của sherpa-onnx, pin SHA-256 trong `stt/download_diarization.py`. Script chỉ giải nén chính xác model/README/LICENSE, không giải nén đường dẫn tùy ý. Trọng số nằm trong `models/diarization/`, bỏ qua bởi Git.

- [Tài liệu và model segmentation chính thức](https://k2-fsa.github.io/sherpa/onnx/speaker-diarization/models.html): pyannote segmentation 3.0, MIT notice nằm trong archive được giữ lại tại `segmentation-LICENSE`.
- [TitaNet-S của NVIDIA](https://catalog.ngc.nvidia.com/orgs/nvidia/nemo/models/titanet_small/-): nguồn speaker embedding; ONNX từ release speaker-recognition của sherpa-onnx. Xem model card nguồn để biết thông tin/attribution của model.
- [Ví dụ Python diarization chính thức](https://github.com/k2-fsa/sherpa-onnx/blob/master/python-api-examples/offline-speaker-diarization.py).

Smoke test dùng các bản ghi tiếng Việt upstream STT để ghép một mẫu cùng giọng dài 8 giây và mẫu A/B/A. File `models/diarization/test-two-vi.wav` được tạo cho việc thử luồng; đó là audio ghép, không phải một bộ benchmark hội thoại y khoa tự nhiên.

### API phiên và bộ nhớ

| Endpoint qua Next | Backend | Mục đích |
|---|---|---|
| `POST /api/stt/session` | `POST /sessions` | Tạo UUID phiên và hai profile giọng mới |
| `POST /api/stt` + metadata | `POST /transcribe` | Raw WAV tối đa 5s với `X-STT-Session`, `X-STT-Sequence` (bắt đầu 1), `X-STT-Start-Frame` (bắt đầu 0) |
| `POST /api/stt/session/{id}` | `POST /sessions/{id}/finalize` | Chốt phần text tạm sau khi mọi đoạn đã xử lý |
| `DELETE /api/stt/session/{id}` | `DELETE /sessions/{id}` | Xóa audio/profile phiên trong RAM |

Kết quả có `words` (`text`, `start_ms`, `end_ms`, `speaker`, `overlap`), `replace_from_ms`, `stable_until_ms`, `final`. Frontend giữ các từ trước mốc thay thế và thay đuôi bằng danh sách mới đã đối chiếu. Cùng sequence + cùng audio trả lại kết quả cache, không nạp audio hai lần. Payload xung đột hoặc mất thứ tự bị từ chối. Client thử lại lỗi tạm thời tối đa hai lần; khi vẫn lỗi thì dừng phiên và báo rõ phần chưa nhận dạng.

File tải lên dùng `X-STT-Diarize: 1`, backend tự xử lý thành đoạn và trả kết quả có nhãn đầy đủ. File không còn giới hạn 30 giây/20 MB ở trình duyệt, proxy hoặc backend. Luồng tải file không áp timeout suy luận 2 phút; người dùng vẫn có thể hủy yêu cầu.

Backend chỉ giữ 25 giây PCM gần nhất, ngữ cảnh từ có giới hạn và hai vector giọng cho mỗi phiên; tối đa 8 phiên. Phiên bỏ dở hết hạn sau 10 phút không hoạt động. Khi kết thúc hoặc rời trang, client yêu cầu giải phóng; audio, profile và transcript không ghi ra file. Transcript toàn phiên được giữ tại tab, nên hãy sao chép trước khi tải lại trang hoặc bắt đầu phiên mới.

Giữ tab mở và thiết bị hoạt động suốt phiên. Nếu hàng đợi 12 đoạn bị đầy, hệ thống dừng micro và xử lý nốt audio đã nhận, giữ thứ tự. Lỗi thiết bị, sleep, đóng tab hoặc mất kết nối có thể ngắt phiên; không có cơ chế tự thu tiếp trong nền sau khi tab đóng.


### Silero VAD trước Zipformer (2026-11-13)

Cả file tải lên và phiên micro dùng Silero ONNX qua sherpa-onnx trước mỗi lượt nhận dạng. VAD chỉ chọn các khoảng có lời nói; không khử nhiễu đang chồng lên tiếng nói. Backend không dùng RMS làm quyết định nhận dạng nữa. Micro vẫn chia gói tối đa 5 giây để truyền; backend chạy VAD trên cửa sổ cuốn để giữ ngữ cảnh.

Model: `models/vad/silero_vad.onnx`, tải bằng `.venv-stt/Scripts/python.exe -m stt.download_vad` hoặc `npm run stt:setup`; không thêm PyTorch. Có thể đổi đường dẫn bằng `STT_VAD_MODEL`. Artifact được kiểm SHA-256 trong `stt/download_vad.py`. Nguồn: https://k2-fsa.github.io/sherpa/onnx/vad/silero-vad.html . Health trả `vad_ready`; thiếu/lỗi model trả `STT_VAD_MODEL_MISSING`/`STT_VAD_MODEL_INVALID`, không âm thầm quay lại RMS.

Thông số khởi đầu: ngưỡng 0.5, lời nói tối thiểu 150ms, khoảng nghỉ 350ms, đệm 120ms mỗi phía; chia lời nói liên tục khoảng 15 giây. Mỗi khoảng nhận dạng giữ offset tới bản gốc để không làm lệch timestamp/gán người nói. Những giá trị này cần đánh giá trên bản chép chuẩn, đặc biệt câu đáp rất ngắn hoặc người nói nhỏ.

Kiểm tra cục bộ: mẫu `test_wavs/1.wav` có khoảng lời nói; một giây zero và ba giây nhiễu Gaussian tổng hợp không có khoảng lời nói. Bản ghi bệnh nhân 528.06s có 53 khoảng, tổng 232.57s được chọn, khoảng dài nhất 15.81s; VAD khoảng 1.70s. Đo này dùng nội suy tuyến tính chỉ cho chẩn đoán, chưa đo độ đúng bản chép và không chứng minh tất cả lời nói được giữ. Chưa bật Community-1 hay khử nhiễu chuyên biệt.


### Gán người nói thận trọng hơn (2026-11-13)

Giữ model segmentation và TitaNet hiện có, chạy CPU cục bộ. Hồ sơ giọng trong phiên được cập nhật bằng trung bình vector chuẩn hóa chỉ khi khớp đủ mạnh và có khoảng cách với ứng viên còn lại; bằng chứng mơ hồ không cập nhật hồ sơ. Các cửa sổ cuốn có thể chứa lại cùng audio nên số quan sát không phải số mẫu độc lập. Hai local cluster cùng hoạt động không được ép về cùng một ID; fragment nối tiếp vẫn có thể cùng người. Hiện vẫn hỗ trợ tối đa hai ID trong phiên; chưa tự gán vai trò bác sĩ/bệnh nhân.

Embedding lấy từ phần không chồng giọng của các lượt, giữ phần sạch thay vì bỏ toàn bộ lượt chỉ vì một đoạn nhỏ bị chồng. Vẫn cần tối thiểu0.8 giây đoạn sạch và tối đa6 giây cho mỗi embedding; câu trả lời quá ngắn có thể chưa rõ người nói.

Gán từ bỏ fallback tìm giọng gần nhất450ms. Do timestamp Zipformer là ước lượng phát token, dùng tối đa160ms gần đầu từ và yêu cầu ít nhất60% thời gian có giọng phủ. Có đổi lượt trong vùng đó thì để chưa rõ; chỉ đánh dấu overlap nếu có hai cụm thực sự đồng thời. Các ngưỡng là heuristic, chưa hiệu chỉnh trên tập bệnh án gán nhãn.

Kiểm chứng gồm test profile, ranh giới, khoảng trống, chồng giọng một phần và rollback khi lỗi; smoke model thật giữ ID cho mẫu5+3 giây và đúng thứ tự A/B/A. Chưa có nhãn thủ công cho file Tim mạch nên chưa báo DER hay phần trăm cải thiện. Các đoạn chưa rõ có thể tăng để giảm gán nhầm. Không thêm Community-1 và không gửi audio bên ngoài.

### DeepFilterNet3 local tùy chọn (2026-11-13)

Cài bằng `npm run stt:denoise:setup`. Script dùng môi trường `.venv-stt`, cài SciPy để resample và tải executable Rust CPU Windows x86_64 từ [release chính thức v0.5.6](https://github.com/Rikorose/DeepFilterNet/releases/tag/v0.5.6). Trọng số DFN3 nằm trong executable; không cần thêm PyTorch/CUDA. SHA-256 được pin và kiểm tra trong `stt/download_denoise.py`: `75e11fa16445f560cb6b021521ddb89e89270d13b83089705d98776f58fd7915`. Có thể chỉ định executable bằng `DENOISE_EXECUTABLE`. Cài đặt cần mạng; nhận dạng và khử nhiễu chạy local.

Mặc định **tắt**. Tại `/stt`, chọn DeepFilterNet3 trước khi tải file hoặc mở micro; trong màn khám, bật lựa chọn khử nhiễu và đồng ý xử lý nội bộ cho từng lần thu. Header `X-STT-Denoise: off|deepfilternet3` truyền lựa chọn cho file hoặc lúc tạo session. Session giữ mode tới khi đóng; gửi mode khác trả `409 DENOISE_MODE_CONFLICT`. Mode không hợp lệ trả `400 DENOISE_MODE_INVALID`; runtime thiếu hoặc xử lý lỗi trả `503 DENOISE_*`, không tự chuyển sang audio gốc.

Audio được resample 16 kHz → 48 kHz, bù độ trễ native bằng padding và `--compensate-delay`, rồi trở về đúng số mẫu 16 kHz. VAD/Zipformer nhận audio đã khử nhiễu, còn ONNX diarization và Community-1 luôn nhận audio gốc. Community-1 vẫn chạy tuần tự sau khi giải phóng recognizer. Micro xử lý lại cửa sổ tối đa 25 giây, chưa phải streaming từng frame; retry cùng chunk trả kết quả cache, không khử nhiễu/lưu trùng. Lỗi không cập nhật sequence, audio hoặc hồ sơ giọng của session.

File dài được chia khối 25 giây, thêm tối đa một giây ngữ cảnh mỗi phía để giảm gián đoạn ở chỗ nối. Không thêm giới hạn upload. WAV tạm chỉ tồn tại local trong lúc native xử lý và được xóa cả khi thành công, timeout hay lỗi thông thường; crash hệ điều hành có thể để lại file tạm. Dữ liệu audio và transcript không được gửi ra cloud. Khử nhiễu không phục hồi lời đã mất hoặc tách độc lập hai người nói chồng nhau.

Kiểm chứng trên máy hiện tại: 94 test Python và 129 test TypeScript đạt; typecheck/lint đạt. Smoke dùng executable thật và mẫu `test_wavs/1.wav` lặp lại, thêm nhiễu Gaussian 0.01, giữ nguyên số mẫu, sample rate và `utterance_ref`. Benchmark riêng bước khử nhiễu (đã import SciPy, chưa gồm VAD/STT/diarization):

| Audio | Thời gian | Hệ số thời gian/audio | Peak working set native |
| --- | --- | --- | --- |
| 5 giây | 0.907 giây | 0.181 | 53.68 MiB |
| 25 giây | 2.893 giây | 0.116 | 53.66 MiB |
| 51 giây | 5.339 giây | 0.105 | 53.62 MiB |

Peak RAM được đọc bằng Windows `GetProcessMemoryInfo` trên từng process native; đây không phải tổng RAM của Python, STT hoặc Community-1. Mẫu 51 giây gọi native ba lần, gồm ngữ cảnh ở chỗ nối. Đây là một lượt đo trên máy hiện tại, không bảo đảm tốc độ cho mọi máy. Smoke chỉ chứng minh runtime local hoạt động; chưa có transcript chuẩn để tính WER hoặc khẳng định độ chính xác tăng. Chưa kiểm thử tự động vòng đời micro bằng trình duyệt thật. Backend được giữ tắt sau kiểm chứng.
