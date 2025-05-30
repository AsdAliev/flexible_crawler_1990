# consumer.py
from kafka import KafkaConsumer
import json

def main():
    consumer = KafkaConsumer(
        'crawler_results',
        bootstrap_servers=['localhost:9092'],
        auto_offset_reset='earliest',
        enable_auto_commit=True,
        group_id='test-group',
        value_deserializer=lambda m: json.loads(m.decode())
    )
    print("Listening to crawler_results…")
    for msg in consumer:
        print("→", msg.value)

if __name__=="__main__":
    main()
