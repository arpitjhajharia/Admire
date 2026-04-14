import React, { useState, useEffect } from 'react';
import { db, appId, secondaryApp } from '../lib/firebase';
import { Trash2, UserPlus, Shield, Edit2, Save, X, Check, Users, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { RULES } from '../lib/permissions';

// Group all permission keys by namespace prefix for the picker
const PERM_GROUPS = Object.keys(RULES).reduce((acc, key) => {
    const ns = key.split('.')[0];
    if (!acc[ns]) acc[ns] = [];
    acc[ns].push(key);
    return acc;
}, {});

const UserManager = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Create User State
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'site_team' });

    // Edit User State
    const [editingId, setEditingId] = useState(null);
    const [editRole, setEditRole] = useState('');
    const [editUsername, setEditUsername] = useState('');
    const [editPassword, setEditPassword] = useState('');

    // Override Panel State
    const [overridesPanel, setOverridesPanel] = useState(null); // userId or null
    const [pendingKey, setPendingKey] = useState('');
    const [pendingVal, setPendingVal] = useState(true);
    const [savingOverride, setSavingOverride] = useState(false);

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

            try {
                userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, newUser.password);
                uid = userCredential.user.uid;
            } catch (authError) {
                if (authError.code === 'auth/email-already-in-use') {
                    email = `${newUser.username.trim().toLowerCase()}_${Date.now()}@admire.internal`;
                    userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, newUser.password);
                    uid = userCredential.user.uid;
                } else {
                    throw authError;
                }
            }

            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('user_roles').doc(uid).set({
                username: newUser.username.trim(),
                email: email,
                role: newUser.role,
                createdAt: new Date().toISOString()
            });

            setNewUser({ username: '', password: '', role: 'site_team' });
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
        setEditRole(user.role || 'site_team');
        setEditUsername(user.username || '');
        setEditPassword('');
        setOverridesPanel(null);
    };

    const saveEdit = async (userObj) => {
        if (!editUsername.trim()) return alert("Username cannot be empty");
        if (editPassword && editPassword.length < 6) return alert("Password must be at least 6 characters");

        try {
            if (editPassword) {
                let newEmail = `${editUsername.trim().toLowerCase()}_${Date.now()}@admire.internal`;
                const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(newEmail, editPassword);
                const newUid = userCredential.user.uid;

                await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('user_roles').doc(newUid).set({
                    username: editUsername.trim(),
                    email: newEmail,
                    role: editRole,
                    overrides: userObj.overrides || {},
                    createdAt: userObj.createdAt || new Date().toISOString()
                });

                await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('user_roles').doc(userObj.id).delete();
            } else {
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

    const addOverride = async (userId) => {
        if (!pendingKey) return;
        setSavingOverride(true);
        try {
            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('user_roles').doc(userId).update({
                [`overrides.${pendingKey}`]: pendingVal
            });
            setPendingKey('');
            setPendingVal(true);
        } catch (err) {
            alert("Failed to save override: " + err.message);
        } finally {
            setSavingOverride(false);
        }
    };

    const removeOverride = async (userId, key) => {
        const userObj = users.find(u => u.id === userId);
        if (!userObj) return;
        const newOverrides = { ...(userObj.overrides || {}) };
        delete newOverrides[key];
        try {
            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('user_roles').doc(userId).update({
                overrides: newOverrides
            });
        } catch (err) {
            alert("Failed to remove override: " + err.message);
        }
    };

    const toggleOverridesPanel = (userId) => {
        setOverridesPanel(prev => prev === userId ? null : userId);
        setEditingId(null);
        setPendingKey('');
        setPendingVal(true);
    };

    const inputCls = "px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 transition-shadow";

    const roleColorCls = (role) => ({
        super_admin:   'text-purple-600 dark:text-purple-400',
        owner:         'text-rose-600 dark:text-rose-400',
        accountant:    'text-blue-600 dark:text-blue-400',
        admin_staff:   'text-teal-600 dark:text-teal-400',
        factory_lead:  'text-amber-600 dark:text-amber-400',
        stock_manager: 'text-indigo-600 dark:text-indigo-400',
    }[role] || 'text-slate-500 dark:text-slate-400');

    return (
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center shadow-sm">
                        <Users className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-white leading-none">
                        Users
                    </h2>
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
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Create New User</h3>
                        <button onClick={() => { setShowForm(false); setNewUser({ username: '', password: '', role: 'site_team' }); }} className="text-xs text-slate-500 flex items-center gap-1 hover:text-red-500 transition-colors"><X size={14} /> Close</button>
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
                            <option value="site_team">Site Team (Field View)</option>
                            <option value="factory_lead">Factory Lead (Stock &amp; Status)</option>
                            <option value="stock_manager">Stock Manager (Inventory Control)</option>
                            <option value="admin_staff">Admin Staff (Quotes &amp; CRM)</option>
                            <option value="accountant">Accountant (Finance View)</option>
                            <option value="owner">Owner (Full Access)</option>
                            <option value="super_admin">Super Admin (System Admin)</option>
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
                        {users.map(u => {
                            const overrides = u.overrides || {};
                            const overrideCount = Object.keys(overrides).length;
                            const isPanelOpen = overridesPanel === u.id;

                            return (
                                <React.Fragment key={u.id}>
                                    <tr className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors ${editingId === u.id ? 'bg-amber-50 dark:bg-amber-900/20' : ''} ${isPanelOpen ? 'bg-violet-50/60 dark:bg-violet-900/10' : ''}`}>
                                        {/* Username */}
                                        <td className="px-1.5 py-1 font-semibold text-slate-800 dark:text-white">
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
                                                <div>
                                                    <span>{u.username || <span className="text-slate-400 italic font-normal" title={u.id}>Unknown</span>}</span>
                                                    {overrideCount > 0 && (
                                                        <span className="ml-1.5 px-1 py-px rounded text-[9px] font-bold bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                                                            {overrideCount} override{overrideCount > 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {/* Role */}
                                        <td className="px-1.5 py-1">
                                            {editingId === u.id ? (
                                                <select
                                                    value={editRole}
                                                    onChange={e => setEditRole(e.target.value)}
                                                    className={inputCls + " py-1 text-xs"}
                                                >
                                                    <option value="site_team">Site Team</option>
                                                    <option value="factory_lead">Factory Lead</option>
                                                    <option value="stock_manager">Stock Manager</option>
                                                    <option value="admin_staff">Admin Staff</option>
                                                    <option value="accountant">Accountant</option>
                                                    <option value="owner">Owner</option>
                                                    <option value="super_admin">Super Admin</option>
                                                </select>
                                            ) : (
                                                <span className={`text-xs capitalize font-medium ${roleColorCls(u.role)}`}>
                                                    {(u.role || '').replace(/_/g, ' ')}
                                                </span>
                                            )}
                                        </td>

                                        {/* Actions */}
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
                                                            onClick={() => toggleOverridesPanel(u.id)}
                                                            className={`quote-action-btn w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isPanelOpen ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : 'text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20'}`}
                                                            title="Permission Overrides"
                                                        >
                                                            <Shield size={14} />
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

                                    {/* ── Override Panel ── */}
                                    {isPanelOpen && (
                                        <tr>
                                            <td colSpan="3" className="px-3 py-3 bg-violet-50/80 dark:bg-violet-900/10 border-t border-violet-100 dark:border-violet-900/30">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500 dark:text-violet-400 mb-2">
                                                    Permission Overrides — {u.username}
                                                </p>

                                                {/* Current overrides */}
                                                {overrideCount > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                                        {Object.entries(overrides).map(([key, val]) => (
                                                            <span
                                                                key={key}
                                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${val ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}
                                                            >
                                                                {val ? '✓' : '✗'} {key}
                                                                <button
                                                                    onClick={() => removeOverride(u.id, key)}
                                                                    className="ml-0.5 hover:opacity-70 transition-opacity"
                                                                    title="Remove override"
                                                                >
                                                                    <X size={9} />
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-3">No overrides set. Role defaults apply.</p>
                                                )}

                                                {/* Add new override */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <select
                                                        value={pendingKey}
                                                        onChange={e => setPendingKey(e.target.value)}
                                                        className={inputCls + " py-1 text-xs flex-1 min-w-[200px]"}
                                                    >
                                                        <option value="">— select permission —</option>
                                                        {Object.entries(PERM_GROUPS).map(([ns, keys]) => (
                                                            <optgroup key={ns} label={ns}>
                                                                {keys.filter(k => !(k in overrides)).map(k => (
                                                                    <option key={k} value={k}>{k}</option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>

                                                    <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 text-[11px] font-bold">
                                                        <button
                                                            onClick={() => setPendingVal(true)}
                                                            className={`px-2.5 py-1.5 transition-colors ${pendingVal ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                                        >
                                                            Grant
                                                        </button>
                                                        <button
                                                            onClick={() => setPendingVal(false)}
                                                            className={`px-2.5 py-1.5 transition-colors ${!pendingVal ? 'bg-red-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                                        >
                                                            Deny
                                                        </button>
                                                    </div>

                                                    <button
                                                        onClick={() => addOverride(u.id)}
                                                        disabled={!pendingKey || savingOverride}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-lg transition-colors"
                                                    >
                                                        <Plus size={11} /> {savingOverride ? 'Saving…' : 'Add'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
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
