"""请求体校验（pydantic）。前端使用 camelCase，这里自动转换。"""

from typing import TypeVar

from flask import request
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.errors import ApiError

T = TypeVar("T", bound=BaseModel)


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        str_strip_whitespace=True,
        extra="forbid",
    )


def parse_body(model: type[T]) -> T:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError(400, "bad_request", "请求体必须是 JSON 对象。")
    return model.model_validate(data)
