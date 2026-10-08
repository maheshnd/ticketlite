// /bookings: my bookings (protected: the API returns only the logged-in user's bookings).
import { PageHeading } from "../../components/PageHeading";
import { MyBookings } from "../../features/bookings/MyBookings";

export default function BookingsPage() {
  return (
    <section className="flex flex-col gap-4">
      <PageHeading>My bookings</PageHeading>
      <MyBookings />
    </section>
  );
}
