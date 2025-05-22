# backend/app.py
import os
from flask import Flask, request, jsonify
from pymongo import MongoClient
from bson.objectid import ObjectId
from flask_cors import CORS
from dotenv import load_dotenv
from prometheus_flask_exporter import PrometheusMetrics # Import metrics exporter

load_dotenv() # Load environment variables from .env file if it exists

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# --- Prometheus Metrics Setup ---
# Exclude default metrics about Python/Flask itself if you want cleaner app-specific metrics
# metrics = PrometheusMetrics(app, default_metrics=[])
# Or include default metrics:
metrics = PrometheusMetrics(app)
metrics.info('app_info', 'Backend Application info', version='1.0.0') # Static info metric

# --- Database Connection ---
# Use environment variable for connection string, default to local MongoDB
MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('MONGO_DB_NAME', 'todo')

try:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME] # Use dynamic DB name
    collection = db['items']
    print(f"Successfully connected to MongoDB at {MONGO_URI}, database '{DB_NAME}'")
    # Test connection
    client.admin.command('ping')
    print("Ping successful!")
except Exception as e:
    print(f"ERROR: Could not connect to MongoDB: {e}")
    # You might want the app to exit or handle this more gracefully
    # For now, we'll let it continue, but endpoints will fail
    client = None
    collection = None


# --- Helper for JSON serialization ---
def serialize_doc(doc):
    """ Convert MongoDB doc to JSON serializable dict. """
    if doc and '_id' in doc:
        doc['_id'] = str(doc['_id'])
    return doc

# --- API Endpoints (CRUD) ---

@app.route('/')
@metrics.do_not_track() # Don't track metrics for this simple root endpoint
def home():
    return jsonify({"message": "Welcome to the Flask Backend!"})

# GET all items
@app.route('/items', methods=['GET'])
def get_items():
    if collection is None:
        return jsonify({"error": "Database connection failed"}), 500
    items = [serialize_doc(item) for item in collection.find()]
    return jsonify(items)

# POST a new item
@app.route('/items', methods=['POST'])
def add_item():
    if collection is None:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        data = request.get_json()
        if not data or 'name' not in data or 'description' not in data:
            return jsonify({"error": "Missing 'name' or 'description' in request body"}), 400

        new_item = {
            "name": data['name'],
            "description": data['description']
        }
        result = collection.insert_one(new_item)
        # Inserted document has _id generated, retrieve it to return
        created_item = collection.find_one({"_id": result.inserted_id})
        return jsonify(serialize_doc(created_item)), 201 # 201 Created status
    except Exception as e:
         return jsonify({"error": f"Failed to add item: {e}"}), 500

# PUT (Update) an existing item by ID
@app.route('/items/<item_id>', methods=['PUT'])
def update_item(item_id):
    if collection is None:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing request body"}), 400

        # Define fields that can be updated
        update_data = {}
        if 'name' in data:
            update_data['name'] = data['name']
        if 'description' in data:
            update_data['description'] = data['description']

        if not update_data:
             return jsonify({"error": "No valid fields to update provided ('name', 'description')"}), 400

        result = collection.update_one(
            {'_id': ObjectId(item_id)},
            {'$set': update_data}
        )

        if result.matched_count == 0:
            return jsonify({"error": "Item not found"}), 404
        if result.modified_count == 0:
             # This could mean the data sent was the same as existing data
             return jsonify({"message": "Item found but no changes applied"}), 200

        updated_item = collection.find_one({'_id': ObjectId(item_id)})
        return jsonify(serialize_doc(updated_item))
    except Exception as e:
         return jsonify({"error": f"Failed to update item: {e}"}), 500

# DELETE an item by ID
@app.route('/items/<item_id>', methods=['DELETE'])
def delete_item(item_id):
    if collection is None:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        result = collection.delete_one({'_id': ObjectId(item_id)})
        if result.deleted_count == 1:
            return jsonify({"message": "Item deleted successfully"}), 200 # Some prefer 204 No Content
        else:
            return jsonify({"error": "Item not found"}), 404
    except Exception as e:
         return jsonify({"error": f"Failed to delete item: {e}"}), 500

# --- Prometheus Metrics Endpoint ---
# The prometheus-flask-exporter automatically adds a /metrics endpoint


if __name__ == '__main__':
    # Ensure metrics are registered before running
    app.run(host='0.0.0.0', port=5001, debug=True)