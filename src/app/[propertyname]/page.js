"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "../../firebase";
import { collection, getDocs, query, where, doc, updateDoc, onSnapshot, Timestamp, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
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
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [savingBooking, setSavingBooking] = useState(false);
  const [deletingBooking, setDeletingBooking] = useState(false);

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

  const openBookingPopup = (booking) => {
    setSelectedBooking(booking);
    setEditingBooking({
      guestName: booking.guestName || "",
      phone: booking.phone || "",
      pricePerNight: booking.pricePerNight || 0,
      advancePayment: booking.advancePayment || 0,
      isConfirmed: booking.isConfirmed || false,
      isFullyPaid: booking.isFullyPaid || false,
      extraBed: booking.extraBed || false,
      numberOfRooms: booking.numberOfRooms || 1,
      checkIn: booking.checkIn?.toDate ? booking.checkIn.toDate().toISOString().slice(0, 10) : "",
      checkOut: booking.checkOut?.toDate ? booking.checkOut.toDate().toISOString().slice(0, 10) : "",
    });
  };

  const closeBookingPopup = () => {
    setSelectedBooking(null);
    setEditingBooking(null);
  };

  const saveBookingChanges = async () => {
    if (!selectedBooking || !editingBooking || savingBooking) return;
    
    try {
      setSavingBooking(true);
      const newNumberOfRooms = Number(editingBooking.numberOfRooms);
      const currentNumberOfRooms = selectedBooking.numberOfRooms || 1;
      
      // If the number of rooms changed, we need to create/delete booking records
      if (newNumberOfRooms !== currentNumberOfRooms) {
        const bookingsCol = collection(db, "properties", property.id, "bookings");
        
        if (newNumberOfRooms > currentNumberOfRooms) {
          // Adding more rooms - create new booking records
          for (let i = currentNumberOfRooms; i < newNumberOfRooms; i++) {
            await addDoc(bookingsCol, {
              guestName: editingBooking.guestName.trim(),
              phone: editingBooking.phone.trim(),
              roomIndex: i,
              numberOfRooms: newNumberOfRooms,
              extraBed: Boolean(editingBooking.extraBed),
              pricePerNight: Number(editingBooking.pricePerNight),
              checkIn: Timestamp.fromDate(new Date(editingBooking.checkIn)),
              checkOut: Timestamp.fromDate(new Date(editingBooking.checkOut)),
              advancePayment: Number(editingBooking.advancePayment),
              isConfirmed: Boolean(editingBooking.isConfirmed),
              isFullyPaid: Boolean(editingBooking.isFullyPaid),
              createdAt: serverTimestamp(),
            });
          }
        } else {
          // Removing rooms - delete excess booking records
          const bookings = Array.isArray(property.bookings) ? property.bookings : [];
          const sameGuestBookings = bookings.filter(b => 
            b.guestName === selectedBooking.guestName &&
            b.checkIn?.toDate?.()?.getTime() === selectedBooking.checkIn?.toDate?.()?.getTime() &&
            b.checkOut?.toDate?.()?.getTime() === selectedBooking.checkOut?.toDate?.()?.getTime()
          ).sort((a, b) => (a.roomIndex || 0) - (b.roomIndex || 0));
          
          // Delete bookings beyond the new number of rooms
          for (let i = newNumberOfRooms; i < sameGuestBookings.length; i++) {
            const bookingToDelete = sameGuestBookings[i];
            if (bookingToDelete.id) {
              await deleteDoc(doc(db, "properties", property.id, "bookings", bookingToDelete.id));
            }
          }
        }
      }
      
      // Update the current booking record
      const bookingRef = doc(db, "properties", property.id, "bookings", selectedBooking.id);
      const updateData = {
        guestName: editingBooking.guestName.trim(),
        phone: editingBooking.phone.trim(),
        pricePerNight: Number(editingBooking.pricePerNight),
        advancePayment: Number(editingBooking.advancePayment),
        isConfirmed: Boolean(editingBooking.isConfirmed),
        isFullyPaid: Boolean(editingBooking.isFullyPaid),
        extraBed: Boolean(editingBooking.extraBed),
        numberOfRooms: newNumberOfRooms,
        checkIn: Timestamp.fromDate(new Date(editingBooking.checkIn)),
        checkOut: Timestamp.fromDate(new Date(editingBooking.checkOut)),
      };
      
      await updateDoc(bookingRef, updateData);
      closeBookingPopup();
    } catch (error) {
      console.error("Error updating booking:", error);
    } finally {
      setSavingBooking(false);
    }
  };

  const deleteBooking = async () => {
    if (!selectedBooking || deletingBooking) return;
    
    if (!window.confirm(`Are you sure you want to delete the booking for ${selectedBooking.guestName}?`)) {
      return;
    }
    
    try {
      setDeletingBooking(true);
      const bookingRef = doc(db, "properties", property.id, "bookings", selectedBooking.id);
      await deleteDoc(bookingRef);
      closeBookingPopup();
    } catch (error) {
      console.error("Error deleting booking:", error);
    } finally {
      setDeletingBooking(false);
    }
  };

  const getBookingStatusColor = (booking) => {
    if (booking.isFullyPaid) return "rgba(34, 197, 94, 0.8)"; 
    if (booking.isConfirmed) return "rgba(59, 130, 246, 0.8)";
    return "rgba(107, 114, 128, 0.8)";
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
                  {rooms.map((room, roomIndex) => (
                    <td key={room} className={styles.propertyGridTd} style={{ padding: 0 }}>
                      {(() => {
                        const date = new Date(now.getFullYear(), now.getMonth(), day);
                        const bookings = Array.isArray(property.bookings) ? property.bookings : [];
                        const active = bookings.find(b => {
                          if (!b.checkIn || !b.checkOut) return false;
                          // Check if this booking is for this specific room
                          if (b.roomIndex !== roomIndex) return false;
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
                          <div 
                            style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: 4, 
                              alignItems: 'center',
                              cursor: 'pointer',
                              backgroundColor: getBookingStatusColor(active),
                              color: 'white',
                              height: '100%',
                              width: '100%',
                              justifyContent: 'center',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              outline: 'none',
                              minHeight: '60px',
                              position: 'relative'
                            }}
                            onClick={() => openBookingPopup(active)}
                            title="Click to view/edit booking details"
                          >
                            {(() => {
                              // Check if this is the first day of the booking
                              const inDate = active.checkIn.toDate ? active.checkIn.toDate() : new Date(active.checkIn);
                              const isFirstDay = date.getTime() === new Date(inDate.getFullYear(), inDate.getMonth(), inDate.getDate()).getTime();
                              
                              return isFirstDay ? (
                                <>
                                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{active.guestName}</span>
                                  <span style={{ fontSize: 11, opacity: 0.9 }}>
                                    ${active.pricePerNight}/night {active.extraBed ? '(+ extra bed)' : ''}
                                  </span>
                                  {active.numberOfRooms > 1 && (
                                    <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>
                                      Room {active.roomIndex + 1} of {active.numberOfRooms}
                                    </span>
                                  )}
                                </>
                              ) : null;
                            })()}
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
      
      {/* Booking Details Popup */}
      {selectedBooking && editingBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: '#1f2937',
            color: '#f9fafb',
            padding: '32px',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            border: '1px solid #374151',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <h2 style={{ 
              marginTop: 0, 
              marginBottom: '24px', 
              color: '#f9fafb',
              fontSize: '24px',
              fontWeight: '600',
              borderBottom: '1px solid #374151',
              paddingBottom: '12px'
            }}>Booking Details</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600',
                  color: '#e5e7eb',
                  fontSize: '14px'
                }}>Guest Name</label>
                <input
                  type="text"
                  value={editingBooking.guestName}
                  onChange={(e) => setEditingBooking(prev => ({ ...prev, guestName: e.target.value }))}
                  style={{ 
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #374151',
                    backgroundColor: '#111827',
                    color: '#f9fafb',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#374151'}
                />
              </div>
              
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600',
                  color: '#e5e7eb',
                  fontSize: '14px'
                }}>Phone Number</label>
                <input
                  type="tel"
                  value={editingBooking.phone}
                  onChange={(e) => setEditingBooking(prev => ({ ...prev, phone: e.target.value }))}
                  style={{ 
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #374151',
                    backgroundColor: '#111827',
                    color: '#f9fafb',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#374151'}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    color: '#e5e7eb',
                    fontSize: '14px'
                  }}>Check-in</label>
                  <input
                    type="date"
                    value={editingBooking.checkIn}
                    onChange={(e) => setEditingBooking(prev => ({ ...prev, checkIn: e.target.value }))}
                    style={{ 
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #374151',
                      backgroundColor: '#111827',
                      color: '#f9fafb',
                      fontSize: '16px',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#374151'}
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    color: '#e5e7eb',
                    fontSize: '14px'
                  }}>Check-out</label>
                  <input
                    type="date"
                    value={editingBooking.checkOut}
                    onChange={(e) => setEditingBooking(prev => ({ ...prev, checkOut: e.target.value }))}
                    style={{ 
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #374151',
                      backgroundColor: '#111827',
                      color: '#f9fafb',
                      fontSize: '16px',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#374151'}
                  />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    color: '#e5e7eb',
                    fontSize: '14px'
                  }}>Price per Night</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingBooking.pricePerNight}
                    onChange={(e) => setEditingBooking(prev => ({ ...prev, pricePerNight: e.target.value }))}
                    style={{ 
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #374151',
                      backgroundColor: '#111827',
                      color: '#f9fafb',
                      fontSize: '16px',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#374151'}
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    color: '#e5e7eb',
                    fontSize: '14px'
                  }}>Advance Payment</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingBooking.advancePayment}
                    onChange={(e) => setEditingBooking(prev => ({ ...prev, advancePayment: e.target.value }))}
                    style={{ 
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #374151',
                      backgroundColor: '#111827',
                      color: '#f9fafb',
                      fontSize: '16px',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#374151'}
                  />
                </div>
              </div>
              
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600',
                  color: '#e5e7eb',
                  fontSize: '14px'
                }}>Number of Rooms</label>
                <input
                  type="number"
                  min="1"
                  max={property.rooms}
                  value={editingBooking.numberOfRooms}
                  onChange={(e) => setEditingBooking(prev => ({ ...prev, numberOfRooms: e.target.value }))}
                  style={{ 
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #374151',
                    backgroundColor: '#111827',
                    color: '#f9fafb',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#374151'}
                />
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: '20px', 
                alignItems: 'center',
                padding: '16px',
                backgroundColor: '#111827',
                borderRadius: '8px',
                border: '1px solid #374151'
              }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  color: '#e5e7eb',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  <input
                    type="checkbox"
                    checked={editingBooking.isConfirmed}
                    onChange={(e) => setEditingBooking(prev => ({ ...prev, isConfirmed: e.target.checked }))}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: '#3b82f6'
                    }}
                  />
                  Confirmed
                </label>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  color: '#e5e7eb',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  <input
                    type="checkbox"
                    checked={editingBooking.isFullyPaid}
                    onChange={(e) => setEditingBooking(prev => ({ ...prev, isFullyPaid: e.target.checked }))}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: '#22c55e'
                    }}
                  />
                  Fully Paid
                </label>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  color: '#e5e7eb',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  <input
                    type="checkbox"
                    checked={editingBooking.extraBed}
                    onChange={(e) => setEditingBooking(prev => ({ ...prev, extraBed: e.target.checked }))}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: '#f59e0b'
                    }}
                  />
                  Extra Bed
                </label>
              </div>
              
                            <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'space-between', 
                marginTop: '24px',
                paddingTop: '20px',
                borderTop: '1px solid #374151'
              }}>
                <button
                  onClick={deleteBooking}
                  disabled={deletingBooking}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: '1px solid #dc2626',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: deletingBooking ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    opacity: deletingBooking ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => !deletingBooking && (e.target.style.backgroundColor = '#b91c1c')}
                  onMouseLeave={(e) => !deletingBooking && (e.target.style.backgroundColor = '#dc2626')}
                >
                  {deletingBooking ? 'Deleting...' : 'Delete Booking'}
                </button>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={closeBookingPopup}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '8px',
                      border: '1px solid #374151',
                      backgroundColor: '#374151',
                      color: '#e5e7eb',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#4b5563'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#374151'}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveBookingChanges}
                    disabled={savingBooking}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '8px',
                      border: '1px solid #3b82f6',
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: savingBooking ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      opacity: savingBooking ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => !savingBooking && (e.target.style.backgroundColor = '#2563eb')}
                    onMouseLeave={(e) => !savingBooking && (e.target.style.backgroundColor = '#3b82f6')}
                  >
                    {savingBooking ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
