#!/usr/bin/env python3
import json
import logging
import os
import time

from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient
from azure.storage.queue import QueueClient

from mock_proteus import simulate


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def main() -> None:
    account_name = os.environ["AZURE_STORAGE_ACCOUNT_NAME"]
    queue_name = os.getenv("OPC_QUEUE_NAME", "opc-jobs")
    results_container = os.getenv("OPC_RESULTS_CONTAINER", "opc-results")
    credential = DefaultAzureCredential()
    queue = QueueClient(
        account_url=f"https://{account_name}.queue.core.windows.net",
        queue_name=queue_name,
        credential=credential,
    )
    blobs = BlobServiceClient(
        account_url=f"https://{account_name}.blob.core.windows.net",
        credential=credential,
    )

    logging.info("OPC worker started for queue %s", queue_name)
    while True:
        messages = queue.receive_messages(messages_per_page=1, visibility_timeout=300)
        message = next(iter(messages), None)
        if message is None:
            time.sleep(3)
            continue

        try:
            job = json.loads(message.content)
            result = {"runId": job["runId"], "recipe": job, "metrics": simulate(job)}
            payload = json.dumps(result, ensure_ascii=True, indent=2).encode("utf-8")
            blob_name = f"runs/{job['runId']}/result.json"
            blobs.get_blob_client(results_container, blob_name).upload_blob(payload, overwrite=True)
            queue.delete_message(message)
            logging.info("Completed %s and uploaded %s", job["runId"], blob_name)
        except Exception:
            logging.exception("Job failed; message will become visible for retry")
            time.sleep(5)


if __name__ == "__main__":
    main()