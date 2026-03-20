import React, { useState, useEffect } from 'react';
import { db, appId, secondaryApp } from '../lib/firebase';
import { Trash2, UserPlus, Shield, Edit2, Save, X, Check, Users } from 'lucide-react';

const UserManager = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Create User State
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'labour' });

    // Edit User State
    const [editingId, setEditingId] = useState(null);
    const [editRole, setEditRole] = useState('');
    const [editUsername, setEditUsername] = useState('');
    const [editPassword, setEditPassword] = useState('');

    // Load Users
    useEffect(() => {
        const unsub = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('user_roles')
            .onSnapshot(snap => {
                const userList = snap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setUsers(userList);
            });
        return () => unsub();
    }, []);

    const handleCreateUser = async () => {
        if (!newUser.username || !newUser.password) return alert("Please fill all fields");
        if (newUser.password.length < 6) return alert("Password must be at least 6 characters");

        setLoading(true);
        try {
            let email = `${newUser.username.trim().toLowerCase()}@admire.internal`;
            let userCredential;
            let uid;

            // 1. Create in Firebase Auth (Using secondary app to keep admin logged in)
            try {
                userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, newUser.password);
                uid = userCredential.user.uid;
            } catch (authError) {
                if (authError.code === 'auth/email-already-in-use') {
                    // Bypass email already in use for previously deleted users
                    email = `${newUser.username.trim().toLowerCase()}_${Date.now()}@admire.internal`;
                    userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, newUser.password);
                    uid = userCredential.user.uid;
                } else {
                    throw authError; // Rethrow if it's a different error
                }
            }

            // 2. Save Role & Username (and updated email) to Firestore
            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('user_roles').doc(uid).set({
                username: newUser.username.trim(),
                email: email, // Store the actual authentication email
                role: newUser.role,
                createdAt: new Date().toISOString()
            });

            setNewUser({ username: '', password: '', role: 'labour' });
            setShowForm(false);
            alert("User Created Successfully");
        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId, username) => {
        if (!confirm(`Are you sure you want to remove access for "${username}"?`)) return;

        try {
            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('user_roles').doc(userId).delete();
        } catch (error) {
            console.error(error);
            alert("Error deleting user role: " + error.message);
        }
    };

    const startEditing = (user) => {
        setEditingId(user.id);
        setEditRole(user.role || 'labour');
        setEditUsername(user.username || '');
        setEditPassword('');
    };

    const saveEdit = async (userObj) => {
        if (!editUsername.trim()) return alert("Username cannot be empty");
        if (editPassword && editPassword.length < 6) return alert("Password must be at least 6 characters");

        try {
            if (editPassword) {
                // Changing password requires recreating the Auth user.
                let newEmail = `${editUsername.trim().toLowerCase()}_${Date.now()}@admire.internal`;
                const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(newEmail, editPassword);
                const newUid = userCredential.user.uid;

                await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('user_roles').doc(newUid).set({
                    username: editUsername.trim(),
                    email: newEmail,
                    role: editRole,
                    createdAt: userObj.createdAt || new Date().toISOString()
                });

                await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('user_roles').doc(userObj.id).delete();
            } else {
                // Just update username and role without touching Firebase Auth
                await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('user_roles').doc(userObj.id).update({
                    username: editUsername.trim(),
                    role: editRole
                });
            }
            setEditingId(null);
        } catch (error) {
            console.error(error);
            alert("Update failed: " + error.message);
        }
    };

    // Shared input class
    const inputCls = "px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 transition-shadow";

    return (
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center shadow-sm">
                        <Users className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-white leading-none">
                            Users
                        </h2>
                    </div>
                </div>

                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex-shrink-0 bg-slate-800 dark:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-slate-900 dark:hover:bg-slate-500 transition-colors shadow-sm"
                    >
                        <UserPlus size={15} /> Add User
                    </button>
                )}
            </div>

            {/* ── Create User Form ── */}
            {showForm && (
                <div className="p-3 rounded-xl border mb-4 bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-600">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">➕ Create New User</h3>
                        <button onClick={() => { setShowForm(false); setNewUser({ username: '', password: '', role: 'labour' }); }} className="text-xs text-slate-500 flex items-center gap-1 hover:text-red-500 transition-colors"><X size={14} /> Close</button>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2">
                        <input
                            type="text"
                            placeholder="Username (e.g. arpit)"
                            value={newUser.username}
                            onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                            className={inputCls + " flex-1"}
                        />
                        <input
                            type="password"
                            placeholder="Password (min 6 chars)"
                            value={newUser.password}
                            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                            className={inputCls + " flex-1"}
                        />
                        <select
                            value={newUser.role}
                            onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                            className={inputCls}
                        >
                            <option value="labour">Labour (Read Only)</option>
                            <option value="supervisor">Supervisor (Can Update Stock)</option>
                            <option value="manager">Manager (Can Edit Price/Quotes)</option>
                            <option value="super_admin">Super Admin (Full Access)</option>
                        </select>
                        <button
                            onClick={handleCreateUser}
                            disabled={loading}
                            className="bg-slate-800 dark:bg-slate-600 hover:bg-slate-900 dark:hover:bg-slate-500 text-white px-4 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-bold transition-colors shadow-sm"
                        >
                            {loading ? 'Saving...' : <><UserPlus size={15} /> Add</>}
                        </button>
                    </div>
                </div>
            )}

            {/* ── User List Table ── */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-700/80 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <tr>
                            <th className="px-1.5 py-1.5 font-bold">Username</th>
                            <th className="px-1.5 py-1.5 font-bold">Role</th>
                            <th className="px-1.5 py-1.5 text-right font-bold">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                        {users.map(u => (
                            <tr key={u.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors ${editingId === u.id ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                                <td className="px-1.5 py-1 font-semibold text-slate-800 dark:text-white relative">
                                    {editingId === u.id ? (
                                        <div className="flex flex-col gap-1">
                                            <input
                                                type="text"
                                                value={editUsername}
                                                onChange={e => setEditUsername(e.target.value)}
                                                className={inputCls + " py-1 text-xs min-w-[120px]"}
                                                placeholder="Username"
                                                autoFocus
                                            />
                                            <input
                                                type="password"
                                                value={editPassword}
                                                onChange={e => setEditPassword(e.target.value)}
                                                className={inputCls + " py-1 text-xs min-w-[120px]"}
                                                placeholder="New Password (optional)"
                                            />
                                        </div>
                                    ) : (
                                        u.username || <span className="text-slate-400 italic font-normal text-xs" title={u.id}>Unknown (ID: {u.id.substr(0, 8)}…)</span>
                                    )}
                                </td>
                                <td className="px-1.5 py-1">
                                    {editingId === u.id ? (
                                        <select
                                            value={editRole}
                                            onChange={e => setEditRole(e.target.value)}
                                            className={inputCls + " py-1 text-xs"}
                                        >
                                            <option value="labour">Labour</option>
                                            <option value="supervisor">Supervisor</option>
                                            <option value="manager">Manager</option>
                                            <option value="super_admin">Super Admin</option>
                                        </select>
                                    ) : (
                                        <span className={`text-xs capitalize font-medium ${u.role === 'super_admin' ? 'text-purple-600 dark:text-purple-400' :
                                            u.role === 'manager' ? 'text-blue-600 dark:text-blue-400' :
                                                u.role === 'supervisor' ? 'text-amber-600 dark:text-amber-400' :
                                                    'text-slate-500 dark:text-slate-400'
                                            }`}>
                                            {u.role.replace('_', ' ')}
                                        </span>
                                    )}
                                </td>
                                <td className="px-1.5 py-1 text-right align-top">
                                    <div className="flex justify-end gap-1 mt-1">
                                        {editingId === u.id ? (
                                            <>
                                                <button onClick={() => saveEdit(u)} className="quote-action-btn w-7 h-7 rounded-lg flex items-center justify-center text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" title="Save">
                                                    <Check size={14} />
                                                </button>
                                                <button onClick={() => setEditingId(null)} className="quote-action-btn w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" title="Cancel">
                                                    <X size={14} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => startEditing(u)} className="quote-action-btn w-7 h-7 rounded-lg flex items-center justify-center text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Edit">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(u.id, u.username || 'User')}
                                                    className="quote-action-btn w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    title="Delete User"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan="3" className="px-1.5 py-5 text-center">
                                    <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                    <p className="text-sm text-slate-400">No users found.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UserManager;