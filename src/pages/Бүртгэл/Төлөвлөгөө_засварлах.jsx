import React, { useState } from "react";
import { Button } from "antd"; // Ant Design Button ашиглавал

const Modal = ({ isOpen, onClose, children }) => {
  
    if (!isOpen) return null;
      console.log("Modal isOpen:", children);
    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <button style={styles.closeBtn} onClick={onClose}>
                    ×
                </button>
                {children}
            </div>
        </div>
    );
};

const Төлөвлөгөө_засварлах = () => {
    const [open, setOpen] = useState(false);

    return (
        <div>
            <Button size="small" onClick={() => setOpen(true)}>
                Засварлах
            </Button>

            <Modal isOpen={open} onClose={() => setOpen(false)}>
                <h2>Модал цонх</h2>
                <p>Энд таны контент орно.</p>
            </Modal>
        </div>
    );
};

const styles = {
    overlay: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
    },
    modal: {
        background: "#fff",
        padding: "24px",
        borderRadius: "8px",
        minWidth: "320px",
        position: "relative",
        boxShadow: "0 2px 16px rgba(0,0,0,0.2)",
    },
    closeBtn: {
        position: "absolute",
        top: "8px",
        right: "12px",
        background: "transparent",
        border: "none",
        fontSize: "1.5rem",
        cursor: "pointer",
    },
};

export default Төлөвлөгөө_засварлах;
