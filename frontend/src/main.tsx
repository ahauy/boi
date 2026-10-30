import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { registerServiceWorker } from "./helpers/registerServiceWorker";
import "@/styles/globals.css";

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
