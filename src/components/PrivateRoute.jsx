import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode"; // ✅ named import

const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem("token");
    const location = useLocation();

    if (!token) {
        console.log(`[ACCESS DENIED] No token. Redirecting from: ${location.pathname}`);
        return <Navigate to="/login" replace />;
    }

    try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;

        if (decoded.exp < currentTime) {
            console.log(`[TOKEN EXPIRED] Token expired. User: ${decoded.email || "unknown"}`);
            localStorage.removeItem("token");
            return <Navigate to="/login" replace />;
        }

        console.log(`[ACCESS GRANTED] Route: ${location.pathname}, User: ${decoded.email || "unknown"}`);
        return children;

    } catch (err) {
        console.error(`[INVALID TOKEN] Failed to decode token. Redirecting...`, err);
        localStorage.removeItem("token");
        return <Navigate to="/login" replace />;
    }
};

export default PrivateRoute;
