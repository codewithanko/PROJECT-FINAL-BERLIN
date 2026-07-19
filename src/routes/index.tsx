import { createFileRoute, redirect } from "@tanstack/react-router";
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://77d787875b6ef2bbfb09530f8daf656b@o4511763169935360.ingest.us.sentry.io/4511763181469696",
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: []
  }
});

const container = document.getElementById("app");
const root = createRoot(container);
root.render(<App />);

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
