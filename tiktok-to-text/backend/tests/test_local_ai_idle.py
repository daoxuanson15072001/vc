"""SYS-41 / TK-17: model Ollama được nhả khi rảnh, không cần Ollama thật."""

from unittest.mock import Mock

from app.kb import local_ai


def _response(data):
    res = Mock()
    res.raise_for_status.return_value = None
    res.json.return_value = data
    return res


def test_goi_llm_nha_model_ngay_khi_cau_hinh_0(monkeypatch):
    post = Mock(side_effect=[
        _response({"choices": [{"message": {"content": '{"text":"x"}'}, "finish_reason": "stop"}],
                   "usage": {}}),
        _response({}),
    ])
    monkeypatch.setattr(local_ai.httpx, "post", post)
    monkeypatch.setattr(local_ai, "LOCAL_AI_IDLE_SECONDS", 0)

    assert local_ai.local_call("luật", "hỏi", {"type": "object"})["text"] == "x"
    assert post.call_args_list[1].args[0].endswith("/api/generate")
    assert post.call_args_list[1].kwargs["json"] == {"model": local_ai.LOCAL_LLM_MODEL, "keep_alive": 0}


def test_embedding_nha_dung_model_va_api(monkeypatch):
    post = Mock(side_effect=[
        _response({"data": [{"index": 0, "embedding": [0.1, 0.2]}]}),
        _response({}),
    ])
    monkeypatch.setattr(local_ai.httpx, "post", post)
    monkeypatch.setattr(local_ai, "LOCAL_AI_IDLE_SECONDS", 0)

    assert local_ai.embed(["abc"]) == [[0.1, 0.2]]
    assert post.call_args_list[1].args[0].endswith("/api/embed")
    assert post.call_args_list[1].kwargs["json"] == {
        "model": local_ai.LOCAL_EMBED_MODEL, "keep_alive": 0, "input": ""}


def test_unload_all_nha_ca_hai_model(monkeypatch):
    post = Mock(return_value=_response({}))
    monkeypatch.setattr(local_ai.httpx, "post", post)

    local_ai.unload_all()

    assert [call.args[0].rsplit("/", 2)[-2:] for call in post.call_args_list] == [
        ["api", "generate"], ["api", "embed"]]


def test_khong_nha_khi_con_loi_goi_dong_thoi(monkeypatch):
    post = Mock(return_value=_response({}))
    monkeypatch.setattr(local_ai.httpx, "post", post)
    monkeypatch.setattr(local_ai, "LOCAL_AI_IDLE_SECONDS", 0)

    local_ai.begin_use(local_ai.LOCAL_LLM_MODEL)
    local_ai.begin_use(local_ai.LOCAL_LLM_MODEL)
    local_ai.end_use(local_ai.LOCAL_LLM_MODEL)
    assert post.call_count == 0

    local_ai.end_use(local_ai.LOCAL_LLM_MODEL)
    assert post.call_count == 1
