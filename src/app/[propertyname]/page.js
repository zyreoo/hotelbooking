"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "../../firebase";
import { collection, getDocs, query, where, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { format, getDaysInMonth } from "date-fns";
import styles from "../page.module.css";
import Link from "next/link";

export default function PropertyPage() {
  const { propertyname } = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingRoomIndex, setEditingRoomIndex] = useState(null);
  const [editedRoomName, setEditedRoomName] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingRoom, setAddingRoom] = useState(false);

  useEffect(() => {
    let unsubscribe = null;
    
    const fetchProperty = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "properties"), where("name", "==", decodeURIComponent(propertyname)));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const propDoc = querySnapshot.docs[0];
          const prop = { id: propDoc.id, ...propDoc.data() };
          setProperty(prop);
          setLoading(false);
          
          // Set up real-time listener for bookings
          unsubscribe = onSnapshot(collection(db, "properties", prop.id, "bookings"), (snap) => {
            const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setProperty((prev) => prev ? { ...prev, bookings } : prev);
          });
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching property:", error);
        setLoading(false);
      }
    };
    
    fetchProperty();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [propertyname]);

  if (loading) return <main style={{ padding: 32 }}><h2>Loading...</h2></main>;
  if (!property) return <main style={{ padding: 32 }}><h2>Property not found</h2></main>;

  const now = new Date();
  const daysInMonth = getDaysInMonth(now);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const rooms = Array.from({ length: property.rooms }, (_, i) => i + 1);

  const getRoomName = (index) => {
    if (property?.roomNames && property.roomNames[index]) return property.roomNames[index];
    return `Room ${index + 1}`;
  };

  const startEdit = (index) => {
    setEditingRoomIndex(index);
    setEditedRoomName(getRoomName(index));
  };

  const cancelEdit = () => {
    setEditingRoomIndex(null);
    setEditedRoomName("");
  };

  const saveEdit = async () => {
    if (editingRoomIndex === null) return;
    if (saving) return;
    const index = editingRoomIndex;
    const totalRooms = property.rooms;
    const existing = Array.isArray(property.roomNames) ? property.roomNames : [];
    const next = Array.from({ length: totalRooms }, (_, i) => existing[i] || `Room ${i + 1}`);
    const finalName = editedRoomName.trim() || `Room ${index + 1}`;
    next[index] = finalName;
    try {
      setSaving(true);
      const ref = doc(db, "properties", property.id);
      await updateDoc(ref, { roomNames: next });
      setProperty((prev) => ({ ...prev, roomNames: next }));
      setEditingRoomIndex(null);
      setEditedRoomName("");
    } finally {
      setSaving(false);
    }
  };

  const handleAddRoom = async () => {
    if (!property) return;
    try {
      setAddingRoom(true);
      const nextRooms = property.rooms + 1;
      const existing = Array.isArray(property.roomNames) ? property.roomNames : [];
      const nextNames = Array.from({ length: nextRooms }, (_, i) => existing[i] || `Room ${i + 1}`);
      const ref = doc(db, "properties", property.id);
      await updateDoc(ref, { rooms: nextRooms, roomNames: nextNames });
      setProperty((prev) => ({ ...prev, rooms: nextRooms, roomNames: nextNames }));
    } finally {
      setAddingRoom(false);
    }
  };

  return (
    <main style={{ padding: 32 }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 18, color: 'var(--foreground)' }}>
        <span style={{ fontSize: 24, lineHeight: 1 }}>&larr;</span> Back
      </Link>
      <h1 style={{ marginBottom: 16 }}>{property.name}</h1>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <p style={{ marginBottom: 0 }}>Rooms: {property.rooms}</p>
        <button onClick={handleAddRoom} className={styles.primary} disabled={addingRoom || saving}>
          {addingRoom ? 'Adding…' : 'Add Room'}
        </button>
      </div>
      {property.rooms > 0 && (
        <div className={styles.propertyGrid}>
          <table className={styles.propertyGridTable}>
            <thead>
              <tr>
                <th className={styles.propertyGridTh + ' ' + styles.propertyGridDay}>Day</th>
                {rooms.map((room, idx) => (
                  <th key={room} className={styles.propertyGridTh + ' ' + styles.propertyGridRoom}>
                    {editingRoomIndex === idx ? (
                      <input
                        value={editedRoomName}
                        onChange={(e) => setEditedRoomName(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveEdit();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        disabled={saving}
                        className={styles.input}
                        style={{ maxWidth: 220, fontSize: 16 }}
                        autoFocus
                      />
                    ) : (
                      <span
                        onClick={() => startEdit(idx)}
                        style={{ cursor: 'text', display: 'inline-block' }}
                        title="Click to edit room name"
                      >
                        {getRoomName(idx)}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(day => (
                <tr key={day}>
                  <td className={styles.propertyGridTd + ' ' + styles.propertyGridDay}>
                    {format(new Date(now.getFullYear(), now.getMonth(), day), 'MMM d')}
                  </td>
                  {rooms.map(room => (
                    <td key={room} className={styles.propertyGridTd}>
                      {(() => {
                        const date = new Date(now.getFullYear(), now.getMonth(), day);
                        const bookings = Array.isArray(property.bookings) ? property.bookings : [];
                        const active = bookings.find(b => {
                          if (!b.checkIn || !b.checkOut) return false;
                          try {
                            const inDate = b.checkIn.toDate ? b.checkIn.toDate() : new Date(b.checkIn);
                            const outDate = b.checkOut.toDate ? b.checkOut.toDate() : new Date(b.checkOut);
                            // Treat nights as [checkIn, checkOut) – not including checkout day
                            return date >= new Date(inDate.getFullYear(), inDate.getMonth(), inDate.getDate()) && date < new Date(outDate.getFullYear(), outDate.getMonth(), outDate.getDate());
                          } catch {
                            return false;
                          }
                        });
                        return active ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                            <span style={{ fontWeight: 600 }}>{active.guestName}</span>
                            <span style={{ fontSize: 12, opacity: 0.8 }}>
                              ${active.pricePerNight}/night {active.extraBed ? '(+ extra bed)' : ''}
                            </span>
                          </div>
                        ) : null;
                      })()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
