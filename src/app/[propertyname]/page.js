"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "../../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { format, getDaysInMonth } from "date-fns";
import styles from "../page.module.css";
import Link from "next/link";

export default function PropertyPage() {
  const { propertyname } = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProperty = async () => {
      setLoading(true);
      const q = query(collection(db, "properties"), where("name", "==", decodeURIComponent(propertyname)));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setProperty({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() });
      }
      setLoading(false);
    };
    fetchProperty();
  }, [propertyname]);

  if (loading) return <main style={{ padding: 32 }}><h2>Loading...</h2></main>;
  if (!property) return <main style={{ padding: 32 }}><h2>Property not found</h2></main>;

  const now = new Date();
  const daysInMonth = getDaysInMonth(now);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const rooms = Array.from({ length: property.rooms }, (_, i) => i + 1);

  return (
    <main style={{ padding: 32 }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 18, color: 'var(--foreground)' }}>
        <span style={{ fontSize: 24, lineHeight: 1 }}>&larr;</span> Back
      </Link>
      <h1 style={{ marginBottom: 16 }}>{property.name}</h1>
      <p style={{ marginBottom: 32 }}>Rooms: {property.rooms}</p>
      {property.rooms > 0 && (
        <div className={styles.propertyGrid}>
          <table className={styles.propertyGridTable}>
            <thead>
              <tr>
                <th className={styles.propertyGridTh + ' ' + styles.propertyGridDay}>Day</th>
                {rooms.map(room => (
                  <th key={room} className={styles.propertyGridTh + ' ' + styles.propertyGridRoom}>Room {room}</th>
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
                      {/* Empty for now */}
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
