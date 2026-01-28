import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';
import { AuthService } from '../../services/AuthService';
import { jwtDecode } from "jwt-decode";

export const LoginModal: React.FC = () => {
    const { login } = useAuth();

    // Login State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Register State
    const [isRegistering, setIsRegistering] = useState(false);
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [googleToken, setGoogleToken] = useState('');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleManualLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await AuthService.login(email, password);
            login(data.access_token, data.user);
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setError('');
        setLoading(true);
        try {
            const token = credentialResponse.credential;
            const data = await AuthService.googleLogin(token);
            login(data.access_token, data.user);
        } catch (err: any) {
            console.error("Google Login Error", err);

            if (err.status === 404) {
                // User not found -> Register
                const token = credentialResponse.credential;
                try {
                    const decoded: any = jwtDecode(token);
                    setRegEmail(decoded.email);
                    setRegName(decoded.name || '');
                    setGoogleToken(token);
                    setIsRegistering(true);
                    setError('');
                } catch (decodeErr) {
                    setError('Error al leer datos de Google');
                }
            } else {
                setError(err.message || 'Error con Google Login');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await AuthService.register(regName, regEmail, googleToken);
            login(data.access_token, data.user);
        } catch (err: any) {
            setError(err.message || 'Error al registrar usuario');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '8px',
                width: '100%',
                maxWidth: '400px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <h2 style={{ marginBottom: '1.5rem', textAlign: 'center', color: '#333' }}>
                    {isRegistering ? 'Registro Usuario' : 'Acceso Almacén'}
                </h2>

                {isRegistering ? (
                    // REGISTER FORM
                    <form onSubmit={handleRegister}>
                        <div style={{ marginBottom: '1rem', textAlign: 'center', color: '#666', fontSize: '0.9em' }}>
                            <p>No tienes cuenta. Regístrate para continuar.</p>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#555' }}>Email</label>
                            <input
                                type="email"
                                value={regEmail}
                                disabled
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', backgroundColor: '#f0f0f0' }}
                            />
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#555' }}>Nombre</label>
                            <input
                                type="text"
                                value={regName}
                                onChange={e => setRegName(e.target.value)}
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                                required
                            />
                        </div>

                        {error && (
                            <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.9em', textAlign: 'center' }}>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%', padding: '10px', backgroundColor: '#4CAF50', color: 'white',
                                border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold'
                            }}
                        >
                            {loading ? 'Registrando...' : 'Confirmar Registro'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsRegistering(false)}
                            style={{
                                width: '100%', padding: '10px', marginTop: '10px', backgroundColor: 'transparent', color: '#777',
                                border: 'none', cursor: 'pointer'
                            }}
                        >
                            Cancelar
                        </button>
                    </form>

                ) : (
                    // LOGIN FORM
                    <>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => setError('Google Login Failed')}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0' }}>
                            <div style={{ flex: 1, height: '1px', background: '#ddd' }}></div>
                            <span style={{ padding: '0 10px', color: '#888', fontSize: '0.9em' }}>O manualmente</span>
                            <div style={{ flex: 1, height: '1px', background: '#ddd' }}></div>
                        </div>

                        <form onSubmit={handleManualLogin}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#555' }}>Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#555' }}>Contraseña</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                                    required
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                                <button
                                    type="button"
                                    onClick={() => alert("Por favor, contacta con el administrador del sistema para restablecer tu contraseña.\n\nEl administrador puede editar tu contraseña directamente en la hoja de cálculo de usuarios.")}
                                    style={{ background: 'none', border: 'none', color: '#009688', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9em' }}
                                >
                                    ¿Has olvidado tu contraseña?
                                </button>
                            </div>

                            {error && (
                                <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.9em', textAlign: 'center' }}>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%', padding: '10px', backgroundColor: '#009688', color: 'white',
                                    border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1rem', fontWeight: 'bold'
                                }}
                            >
                                {loading ? 'Verificando...' : 'Entrar'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};
