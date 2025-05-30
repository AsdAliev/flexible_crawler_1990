import os, json, requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Literal

SCRAPYD_URL  = os.getenv("SCRAPYD_URL")
PROJECT_NAME = os.getenv("PROJECT_NAME")
ITEMS_DIR    = os.getenv("ITEMS_DIR")

app = FastAPI(title="Crawler Facade", version="1.0")

class CrawlerRequest(BaseModel):
    start_url: str
    crawler_settings: dict
    meta: list[dict]

@app.post("/jobs/", status_code=201)
def schedule_job(req: CrawlerRequest):
    payload = {
        "project": PROJECT_NAME,
        "spider":  "flexible_spider",
        "config":  json.dumps(req.dict(), ensure_ascii=False),
    }
    r = requests.post(f"{SCRAPYD_URL}/schedule.json", data=payload)
    d = r.json()
    if d.get("status") != "ok":
        raise HTTPException(500, "Не удалось запланировать spider")
    return {"jobid": d["jobid"]}

@app.get("/jobs/{jobid}/status")
def job_status(jobid: str):
    r = requests.get(f"{SCRAPYD_URL}/listjobs.json", params={"project": PROJECT_NAME})
    jobs = r.json()
    for st in ("pending", "running"):
        if any(j["id"] == jobid for j in jobs.get(st, [])):
            return {"jobid": jobid, "status": st}
    if any(j["id"] == jobid for j in jobs.get("finished", [])):
        return {"jobid": jobid, "status": "finished"}
    raise HTTPException(404, "Job not found")

@app.get("/jobs/{jobid}/result")
def job_result(jobid: str, format: Literal["json","csv","xml"]="json"):
    status = job_status(jobid)["status"]
    if status != "finished":
        return {"jobid": jobid, "status": status}

    jl = os.path.join(ITEMS_DIR, PROJECT_NAME, "flexible_spider", f"{jobid}.jl")
    if not os.path.exists(jl):
        raise HTTPException(404, "Result file not found")
    items = [json.loads(l) for l in open(jl, encoding="utf-8")]

    if format == "json":
        tmp = f"/tmp/{jobid}.json"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        return FileResponse(tmp, filename=f"{jobid}.json")

    if format == "csv":
        import csv
        from flex_crawler.pipelines import flatten_selected_fields  # или ваш util
        rows = [flatten_selected_fields(i) for i in items]
        keys = sorted({k for r in rows for k in r})
        tmp = f"/tmp/{jobid}.csv"
        with open(tmp, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, keys)
            w.writeheader()
            w.writerows(rows)
        return FileResponse(tmp, filename=f"{jobid}.csv")

    if format == "xml":
        import xml.etree.ElementTree as ET, xml.dom.minidom as md
        from flex_crawler.pipelines import dict_to_xml
        root = ET.Element("items")
        for it in items:
            el = ET.SubElement(root, "item")
            dict_to_xml(el, it)
        rough = ET.tostring(root, encoding="utf-8")
        pretty = md.parseString(rough).toprettyxml(indent="  ", encoding="utf-8")
        tmp = f"/tmp/{jobid}.xml"
        with open(tmp, "wb") as f: f.write(pretty)
        return FileResponse(tmp, filename=f"{jobid}.xml")

    raise HTTPException(400, "Unsupported format")
