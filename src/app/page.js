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
    updateDoc,
    serverTimestamp,
    Timestamp
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
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingName, setBookingName] = useState("");
  const [bookingRooms, setBookingRooms] = useState(1);
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingPropertyId, setBookingPropertyId] = useState("");
  const [bookingExtraBed, setBookingExtraBed] = useState(false);
  const [bookingPrice, setBookingPrice] = useState("");
  const [bookingCheckIn, setBookingCheckIn] = useState("");
  const [bookingCheckOut, setBookingCheckOut] = useState("");

  useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      const q = query(collection(db, "properties"), orderBy("name"));
      const querySnapshot = await getDocs(q);
      const props = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProperties(props);
      if (!bookingPropertyId && props.length > 0) {
        setBookingPropertyId(props[0].id);
      }
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
  const selectedProperty = properties.find((p) => p.id === bookingPropertyId);
  const selectedRooms = selectedProperty ? selectedProperty.rooms : 0;
  const normalizeYmd = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const computeNights = (inStr, outStr) => {
    if (!inStr || !outStr) return 0;
    const ci = normalizeYmd(new Date(inStr));
    const co = normalizeYmd(new Date(outStr));
    const diffMs = co - ci;
    return diffMs > 0 ? Math.round(diffMs / (1000 * 60 * 60 * 24)) : 0;
  };
  const nights = computeNights(bookingCheckIn, bookingCheckOut);
  const todayIso = new Date().toISOString().slice(0, 10);
  const checkoutMin = bookingCheckIn || todayIso;

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    if (!bookingName.trim()) return;
    if (!bookingPropertyId) return;
    const roomsNum = Number(bookingRooms);
    if (!roomsNum || roomsNum < 1) return;
    const priceNum = Number(bookingPrice);
    if (Number.isNaN(priceNum) || priceNum < 0) return;
    if (!bookingCheckIn || !bookingCheckOut) return;
    const checkInDate = new Date(bookingCheckIn);
    const checkOutDate = new Date(bookingCheckOut);
    if (!(checkOutDate > checkInDate)) return;
    
    // Get the selected property to know how many rooms are available
    const selectedProperty = properties.find(p => p.id === bookingPropertyId);
    if (!selectedProperty) return;
    
    try {
      setBookingSaving(true);
      const bookingsCol = collection(db, "properties", bookingPropertyId, "bookings");
      
      for (let i = 0; i < roomsNum; i++) {
        await addDoc(bookingsCol, {
          guestName: bookingName.trim(),
          phone: bookingPhone.trim(),
          roomIndex: i,
          numberOfRooms: roomsNum,
          extraBed: Boolean(bookingExtraBed),
          pricePerNight: priceNum,
          checkIn: Timestamp.fromDate(checkInDate),
          checkOut: Timestamp.fromDate(checkOutDate),
          advancePayment: 0, 
          isConfirmed: false, 
          isFullyPaid: false,
          createdAt: serverTimestamp(),
        });
      }
      
      setBookingName("");
      setBookingPhone("");
      setBookingRooms(1);
      setBookingExtraBed(false);
      setBookingPrice("");
      setBookingCheckIn("");
      setBookingCheckOut("");
      setBookingOpen(false);
    } finally {
      setBookingSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Properties</h1>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => setBookingOpen((v) => !v)}
            className={styles.primary}
          >
            {bookingOpen ? 'Close Booking' : 'New Booking'}
          </button>
        </div>
        {bookingOpen && (
          <form onSubmit={handleCreateBooking} className={styles.form} style={{ flexWrap: 'wrap' }}>
            <select
              value={bookingPropertyId}
              onChange={(e) => setBookingPropertyId(e.target.value)}
              className={styles.input}
              disabled={loading || bookingSaving || properties.length === 0}
              style={{ minWidth: 180 }}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Guest name"
              value={bookingName}
              onChange={(e) => setBookingName(e.target.value)}
              disabled={bookingSaving}
              className={styles.input}
              style={{ minWidth: 220 }}
            />
            <input
              type="tel"
              placeholder="Phone number"
              value={bookingPhone}
              onChange={(e) => setBookingPhone(e.target.value)}
              disabled={bookingSaving}
              className={styles.input}
              style={{ minWidth: 180 }}
            />
            <input
              type="number"
              min={1}
              placeholder="Rooms"
              value={bookingRooms}
              onChange={(e) => setBookingRooms(e.target.value)}
              disabled={bookingSaving}
              className={styles.input}
              style={{ width: 110 }}
            />
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Price / night"
              value={bookingPrice}
              onChange={(e) => setBookingPrice(e.target.value)}
              disabled={bookingSaving}
              className={styles.input}
              style={{ width: 150 }}
            />
            <input
              type="date"
              value={bookingCheckIn}
              onChange={(e) => setBookingCheckIn(e.target.value)}
              disabled={bookingSaving}
              className={styles.input}
              min={todayIso}
              style={{ width: 170 }}
            />
            <input
              type="date"
              value={bookingCheckOut}
              onChange={(e) => setBookingCheckOut(e.target.value)}
              disabled={bookingSaving}
              className={styles.input}
              min={checkoutMin}
              style={{ width: 170 }}
            />
            {nights > 0 && (
              <span style={{ alignSelf: 'center', fontWeight: 600 }}>
                {nights} {nights === 1 ? 'night' : 'nights'}
              </span>
            )}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={bookingExtraBed}
                onChange={(e) => setBookingExtraBed(e.target.checked)}
                disabled={bookingSaving}
              />
              Extra bed
            </label>
            <button
              type="submit"
              disabled={
                bookingSaving ||
                !bookingName.trim() ||
                !bookingPropertyId ||
                !bookingCheckIn ||
                !bookingCheckOut ||
                nights <= 0
              }
              className={styles.primary}
            >
              {bookingSaving ? 'Saving…' : 'Save Booking'}
            </button>
          </form>
        )}
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
