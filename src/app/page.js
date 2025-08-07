"use client";
import styles from "./page.module.css";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy
} from "firebase/firestore";

export default function Home() {
  const [properties, setProperties] = useState([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);


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

  // Add new property
  const handleAddProperty = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    await addDoc(collection(db, "properties"), { name: newName.trim() });
    setNewName("");
    setAdding(false);
  };

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
          <button type="submit" disabled={adding || !newName.trim()} className={styles.primary}>
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
              <div key={property.id} className={styles.card}>
                <h2>{property.name}</h2>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
