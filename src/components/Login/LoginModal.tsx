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
            display: 'flex',
            backgroundColor: '#f8f9fa',
            zIndex: 99999,
            fontFamily: "'Inter', 'Segoe UI', Roboto, sans-serif"
        }}>
            {/* Lado Izquierdo: Imagen e Identidad Corporativa */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '4rem',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Fondo de imagen de almacén con overlay verde corporativo */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundImage: 'url("https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    zIndex: 0
                }}/>
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'linear-gradient(135deg, rgba(0, 122, 51, 0.94) 0%, rgba(27, 94, 32, 0.98) 100%)',
                    zIndex: 1
                }}/>

                {/* Contenido Izquierdo */}
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <h1 style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: '1.5rem', lineHeight: 1.1, textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                        Sistema de Gestión <br/>Digital de Almacén
                    </h1>
                    <p style={{ fontSize: '1.2rem', opacity: 0.9, maxWidth: '400px', lineHeight: 1.6 }}>
                        Plataforma centralizada para el control de inventario, gestión de ubicaciones y trazabilidad en tiempo real, del Servicio de eventos deportivos y programas.
                    </p>
                </div>
            </div>

            {/* Lado Derecho: Formulario de Login */}
            <div style={{
                flex: "0 0 450px", /* Ancho fijo para el panel de login */
                backgroundColor: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem',
                boxShadow: '-10px 0 30px rgba(0,0,0,0.08)',
                zIndex: 10
            }}>
                <div style={{ width: '100%', maxWidth: '340px' }}>
                    <h2 style={{ fontSize: '2rem', color: '#111', marginBottom: '0.5rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
                        {isRegistering ? 'Crear Cuenta' : 'Bienvenido'}
                    </h2>
                    <p style={{ color: '#666', marginBottom: '2.5rem', fontSize: '1rem' }}>
                        {isRegistering ? 'Completa tus datos para confirmar registro.' : 'Inicia sesión para acceder al panel.'}
                    </p>

                    {isRegistering ? (
                        <form onSubmit={handleRegister}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#444', fontWeight: 600, fontSize: '0.9rem' }}>Email</label>
                                <input
                                    id="reg-email"
                                    name="reg-email"
                                    value={regEmail}
                                    disabled
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#f5f5f5', fontSize: '1rem', color: '#666', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#444', fontWeight: 600, fontSize: '0.9rem' }}>Nombre Completo</label>
                                <input
                                    id="reg-name"
                                    name="reg-name"
                                    type="text"
                                    value={regName}
                                    onChange={e => setRegName(e.target.value)}
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '1rem', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                                    required
                                />
                            </div>

                            {error && (
                                <div style={{ color: '#d32f2f', marginBottom: '1.5rem', fontSize: '0.9rem', backgroundColor: '#ffebee', padding: '10px', borderRadius: '4px', borderLeft: '4px solid #d32f2f' }}>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%', padding: '14px', backgroundColor: '#007A33', color: 'white',
                                    border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1.05rem', fontWeight: 600,
                                    boxShadow: '0 4px 12px rgba(0, 122, 51, 0.2)', transition: 'background-color 0.2s'
                                }}
                                onMouseOver={e => !loading && (e.currentTarget.style.backgroundColor = '#00652a')}
                                onMouseOut={e => !loading && (e.currentTarget.style.backgroundColor = '#007A33')}
                            >
                                {loading ? 'Registrando...' : 'Confirmar Cuenta'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsRegistering(false)}
                                style={{
                                    width: '100%', padding: '14px', marginTop: '12px', backgroundColor: 'transparent', color: '#666',
                                    border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', fontWeight: 600,
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseOver={e => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                Cancelar
                            </button>
                        </form>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess}
                                    onError={() => setError('Error al conectar con Google')}
                                    theme="outline"
                                    size="large"
                                    width="100%"
                                />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0' }}>
                                <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }}></div>
                                <span style={{ padding: '0 15px', color: '#888', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>O INGRESA TUS CREDENCIALES</span>
                                <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }}></div>
                            </div>

                            <form onSubmit={handleManualLogin}>
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem', color: '#444', fontWeight: 600, fontSize: '0.9rem' }}>Usuario Institucional / Email</label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="text"
                                        placeholder="ej. victor @ andalucia"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '1rem', transition: 'border-color 0.2s' }}
                                        required
                                    />
                                </div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <label htmlFor="password" style={{ color: '#444', fontWeight: 600, fontSize: '0.9rem' }}>Contraseña</label>
                                        <button
                                            type="button"
                                            onClick={() => alert("Por favor, contacta con la Coordinación TIC para restablecer tu contraseña institucional.")}
                                            style={{ background: 'none', border: 'none', color: '#007A33', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0 }}
                                            onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                                            onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                                        >
                                            ¿Olvidaste tu clave?
                                        </button>
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '1rem', letterSpacing: '2px', transition: 'border-color 0.2s' }}
                                        required
                                    />
                                </div>

                                {error && (
                                    <div style={{ color: '#d32f2f', marginBottom: '1.5rem', fontSize: '0.9rem', backgroundColor: '#ffebee', padding: '10px', borderRadius: '4px', borderLeft: '4px solid #d32f2f' }}>
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        width: '100%', padding: '14px', backgroundColor: '#007A33', color: 'white',
                                        border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1.05rem', fontWeight: 600,
                                        boxShadow: '0 4px 12px rgba(0, 122, 51, 0.2)', transition: 'transform 0.1s, background-color 0.2s',
                                        marginTop: '0.5rem'
                                    }}
                                    onMouseOver={e => !loading && (e.currentTarget.style.backgroundColor = '#00652a')}
                                    onMouseOut={e => !loading && (e.currentTarget.style.backgroundColor = '#007A33')}
                                >
                                    {loading ? 'Verificando Sistema...' : 'Acceder al Almacén'}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
