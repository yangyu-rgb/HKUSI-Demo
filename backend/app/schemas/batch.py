from pydantic import BaseModel, Field


class BatchEmployee(BaseModel):
    id: int | str
    departure: str = Field(min_length=1)
    destination: str = "深圳南山"
    arrival_deadline: str = Field(pattern=r"^\d{2}:\d{2}$")


class BatchRequest(BaseModel):
    company: str = Field(min_length=1)
    employees: list[BatchEmployee] = Field(min_length=1, max_length=100)
    date: str
