"""统一错误响应：{title, code, fields?}。前端 handleServerError 读取 title 作为提示。"""

from flask import Flask, jsonify
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException


class ApiError(Exception):
    def __init__(
        self,
        status: int,
        code: str,
        title: str,
        fields: dict[str, str] | None = None,
        extra: dict | None = None,
    ):
        super().__init__(title)
        self.status = status
        self.code = code
        self.title = title
        self.fields = fields
        self.extra = extra or {}

    def to_response(self):
        body = {"title": self.title, "code": self.code, **self.extra}
        if self.fields:
            body["fields"] = self.fields
        return jsonify(body), self.status


def not_found(what: str = "资源") -> ApiError:
    return ApiError(404, "not_found", f"{what}不存在。")


def forbidden(title: str = "无权执行此操作。") -> ApiError:
    return ApiError(403, "forbidden", title)


def validation_error_fields(err: ValidationError) -> dict[str, str]:
    fields: dict[str, str] = {}
    for e in err.errors():
        loc = ".".join(str(p) for p in e["loc"]) or "body"
        fields.setdefault(loc, e["msg"])
    return fields


_HTTP_TITLES = {
    400: "请求格式不正确。",
    401: "请先登录。",
    403: "无权执行此操作。",
    404: "接口不存在。",
    405: "不支持的请求方法。",
    413: "上传的文件过大。",
    415: "不支持的内容类型。",
    429: "请求过于频繁，请稍后再试。",
}


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(ApiError)
    def _api_error(err: ApiError):
        return err.to_response()

    @app.errorhandler(ValidationError)
    def _validation(err: ValidationError):
        return ApiError(
            422, "validation_error", "提交的数据有误。", validation_error_fields(err)
        ).to_response()

    @app.errorhandler(HTTPException)
    def _http(err: HTTPException):
        status = err.code or 500
        title = _HTTP_TITLES.get(status, err.description or "请求失败。")
        return jsonify({"title": title, "code": err.name.lower().replace(" ", "_")}), status

    @app.errorhandler(Exception)
    def _unhandled(err: Exception):
        app.logger.exception("Unhandled error")
        return jsonify({"title": "服务器内部错误！", "code": "internal_error"}), 500
