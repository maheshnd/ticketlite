// Home page: the list of upcoming events. The list itself is a client component (React Query);
// this page only adds the heading, so the static HTML already has meaningful content.
import { EventList } from "../features/events/EventList";

export default function HomePage() {
  return (
    <section aria-labelledby="home-title">
      <h1 id="home-title" className="text-2xl font-bold">
        Upcoming events
      </h1>
      <EventList />
    </section>
  );
}
