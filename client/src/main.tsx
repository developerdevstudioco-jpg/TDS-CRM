// client/src/App.tsx
import React from "react";
import Building2 from "./components/Building2"; // path from src/

function App() {
  return (
    <div>
      <h1>My CRM App</h1>
      <Building2 /> {/* Render the placeholder component */}
    </div>
  );
}

export default App;