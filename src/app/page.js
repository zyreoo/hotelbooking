"use client";
import styles from "./page.module.css";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { format, getDaysInMonth } from "date-fns";

export default function Home() {
  const [properties, setProperties] = useState([]);
  const [newName, setNewName] = useState("");
  const [newRooms, setNewRooms] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [updatingId, setUpdatingId] = useState(null); 

  useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      const q = query(collection(db, "properties"), orderBy("name"));
      const querySnapshot = await getDocs(q);
      setProperties(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    };
    fetchProperties();
  }, [adding]);


  const handleAddProperty = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newRooms || newRooms < 1) return;
    setAdding(true);
    const count = Number(newRooms);
    const defaultNames = Array.from({ length: count }, (_, i) => `Room ${i + 1}`);
    await addDoc(collection(db, "properties"), { name: newName.trim(), rooms: count, roomNames: defaultNames });
    setNewName("");
    setNewRooms(1);
    setAdding(false);
  };

  const handleAddRoom = async (id, currentRooms) => {
    setUpdatingId(id);
    const propertyRef = doc(db, "properties", id);
    const target = properties.find((p) => p.id === id);
    const existingNames = Array.isArray(target?.roomNames) ? target.roomNames : [];
    const nextRooms = currentRooms + 1;
    const nextNames = Array.from({ length: nextRooms }, (_, i) => existingNames[i] || `Room ${i + 1}`);
    await updateDoc(propertyRef, { rooms: nextRooms, roomNames: nextNames });
    setProperties((prev) => prev.map((p) => p.id === id ? { ...p, rooms: nextRooms, roomNames: nextNames } : p));
    setUpdatingId(null);
  };

  const handleDeleteProperty = async (id) => {
    if (!window.confirm("Are you sure you want to delete this property?")) return;
    setLoading(true);
    await deleteDoc(doc(db, "properties", id));
    setLoading(false);
    setProperties((prev) => prev.filter((p) => p.id !== id));
  };

  const router = useRouter();

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Properties</h1>
        <form onSubmit={handleAddProperty} className={styles.form}>
          <input
            type="text"
            placeholder="Property name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            disabled={adding}
            className={styles.input}
          />
          <input
            type="number"
            min={1}
            placeholder="Rooms"
            value={newRooms}
            onChange={e => setNewRooms(e.target.value)}
            disabled={adding}
            className={styles.input}
            style={{ width: 80 }}
          />
          <button type="submit" disabled={adding || !newName.trim() || !newRooms || newRooms < 1} className={styles.primary}>
            {adding ? "Adding..." : "Create Property"}
          </button>
        </form>
        {loading ? (
          <p>Loading properties...</p>
        ) : properties.length === 0 ? (
          <p>No properties found.</p>
        ) : (
          <div className={styles.cards}>
            {properties.map((property) => (
              <div
                key={property.id}
                className={styles.card}
                onClick={e => {
                  if (e.target.tagName === 'BUTTON') return;
                  router.push(`/${encodeURIComponent(property.name)}`);
                }}
                style={{ cursor: "pointer" }}
              >
                <h2>{property.name}</h2>
                <p>Rooms: {property.rooms}</p>
                <button
                  onClick={() => handleAddRoom(property.id, property.rooms)}
                  className={styles.primary}
                  style={{marginTop:8, marginRight:8}}
                  disabled={loading || updatingId === property.id}
                >
                  {updatingId === property.id ? "Adding..." : "Add Room"}
                </button>
                <button onClick={() => handleDeleteProperty(property.id)} className={styles.primary} style={{marginTop:8}} disabled={loading}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
