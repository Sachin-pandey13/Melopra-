import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const PhoneLogin = ({ onClose }) => {
  const { loginWithPhone, verifyOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmObj, setConfirmObj] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    setError("");
    if (!phone.trim()) return setError("Enter a phone number.");

    try {
      setLoading(true);
      const response = await loginWithPhone(phone);
      setConfirmObj(response);
    } catch (err) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    if (!otp.trim()) return setError("Enter the OTP.");

    try {
      setLoading(true);
      await verifyOtp(confirmObj, otp);
      onClose();
    } catch (err) {
      setError("Invalid OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-zinc-900 text-white rounded-lg w-full max-w-sm">
      <div id="recaptcha-container"></div>

      <h2 className="text-xl font-semibold mb-4">Phone Login</h2>

      {error && <p className="text-red-400 mb-2 text-sm">{error}</p>}

      <input
        className="w-full bg-zinc-800 p-2 rounded mb-3"
        placeholder="+91 9876543210"
        onChange={(e) => setPhone(e.target.value)}
      />

      <button
        disabled={loading}
        onClick={handleSend}
        className="w-full bg-purple-600 p-2 rounded mb-4"
      >
        {loading ? "Sending..." : "Send OTP"}
      </button>

      {confirmObj && (
        <>
          <input
            className="w-full bg-zinc-800 p-2 rounded mb-3"
            placeholder="Enter OTP"
            onChange={(e) => setOtp(e.target.value)}
          />

          <button
            disabled={loading}
            onClick={handleVerify}
            className="w-full bg-green-600 p-2 rounded mb-4"
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        </>
      )}

      <button
        onClick={onClose}
        className="w-full py-2 text-gray-400 hover:text-white mt-2"
      >
        Cancel
      </button>
    </div>
  );
};

export default PhoneLogin;
