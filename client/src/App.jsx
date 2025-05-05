// frontend/src/App.jsx
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./App.css"; // We'll create this for basic styling

// --- Configuration ---
// Use environment variable for API URL, default for local/Docker Compose
// In Vite, env vars must start with VITE_
// For K8s, this will be replaced by the Service URL later or use relative path if served by same domain
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001"; // Default Flask port

function App() {
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [editingItem, setEditingItem] = useState(null); // Store item being edited { _id, name, description }
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- API Functions ---
  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/items`);
      setItems(response.data || []); // Ensure it's an array
    } catch (err) {
      console.error("Error fetching items:", err);
      setError(
        `Failed to fetch items: ${err.message}. Is the backend running at ${API_BASE_URL}?`
      );
      setItems([]); // Clear items on error
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies, API_BASE_URL is constant within component lifecycle unless page reloads

  const handleAddItem = async (e) => {
    e.preventDefault(); // Prevent default form submission
    if (!newItemName || !newItemDesc) {
      setError("Name and description cannot be empty.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/items`, {
        name: newItemName,
        description: newItemDesc,
      });
      setItems([...items, response.data]); // Add new item to state
      setNewItemName(""); // Clear form
      setNewItemDesc("");
    } catch (err) {
      console.error("Error adding item:", err);
      setError(
        `Failed to add item: ${err.response?.data?.error || err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (id) => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`${API_BASE_URL}/items/${id}`);
      setItems(items.filter((item) => item._id !== id)); // Remove item from state
    } catch (err) {
      console.error("Error deleting item:", err);
      setError(
        `Failed to delete item: ${err.response?.data?.error || err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (item) => {
    setEditingItem({ ...item }); // Copy item to editing state
  };

  const cancelEditing = () => {
    setEditingItem(null);
  };

  const handleUpdateItem = async (e) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name || !editingItem.description) {
      setError("Name and description cannot be empty during edit.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.put(
        `${API_BASE_URL}/items/${editingItem._id}`,
        {
          name: editingItem.name,
          description: editingItem.description,
        }
      );
      // Update item in the list
      setItems(
        items.map((item) =>
          item._id === editingItem._id ? response.data : item
        )
      );
      setEditingItem(null); // Exit editing mode
    } catch (err) {
      console.error("Error updating item:", err);
      setError(
        `Failed to update item: ${err.response?.data?.error || err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch items on initial render
  useEffect(() => {
    fetchItems();
  }, [fetchItems]); // Dependency array includes fetchItems

  return (
    <div className="App">
      <header className="App-header">
        <h1>Item Management SPA</h1>
      </header>

      {error && <p className="error-message">Error: {error}</p>}
      {loading && <p>Loading...</p>}

      {/* Add/Edit Form */}
      <form
        onSubmit={editingItem ? handleUpdateItem : handleAddItem}
        className="item-form"
      >
        <h2>{editingItem ? "Edit Item" : "Add New Item"}</h2>
        <div className="form-group">
          <label htmlFor="itemName">Name:</label>
          <input
            type="text"
            id="itemName"
            value={editingItem ? editingItem.name : newItemName}
            onChange={(e) =>
              editingItem
                ? setEditingItem({ ...editingItem, name: e.target.value })
                : setNewItemName(e.target.value)
            }
            placeholder="Item Name"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="itemDesc">Description:</label>
          <input
            type="text"
            id="itemDesc"
            value={editingItem ? editingItem.description : newItemDesc}
            onChange={(e) =>
              editingItem
                ? setEditingItem({
                    ...editingItem,
                    description: e.target.value,
                  })
                : setNewItemDesc(e.target.value)
            }
            placeholder="Item Description"
            required
          />
        </div>
        {editingItem ? (
          <>
            <button type="submit" disabled={loading}>
              Update Item
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={loading}
              className="cancel-button"
            >
              Cancel
            </button>
          </>
        ) : (
          <button type="submit" disabled={loading}>
            Add Item
          </button>
        )}
      </form>

      {/* Items List */}
      <div className="items-list">
        <h2>Items</h2>
        {items.length === 0 && !loading ? (
          <p>No items found. Add some!</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item._id} className="item-card">
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <small>ID: {item._id}</small>
                </div>
                <div className="item-actions">
                  <button
                    onClick={() => startEditing(item)}
                    disabled={loading || !!editingItem}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item._id)}
                    disabled={loading || !!editingItem}
                    className="delete-button"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;
