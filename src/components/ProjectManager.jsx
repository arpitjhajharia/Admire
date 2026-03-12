import React, { useState, useEffect } from 'react';
import { db, appId } from '../lib/firebase';
import { Trash2, Plus, Briefcase, X, Edit2, Save } from 'lucide-react';

const ProjectManager = ({ user }) => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Create Project State
    const [newProject, setNewProject] = useState('');

    // Edit Project State
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    // Load Projects
    useEffect(() => {
        const unsub = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('projects')
            .onSnapshot(snap => {
                const projectList = snap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                setProjects(projectList);
            });
        return () => unsub();
    }, []);

    const handleCreateProject = async () => {
        if (!newProject || !newProject.trim()) return alert("Please enter a project name");

        setLoading(true);
        try {
            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('projects').add({
                name: newProject.trim().toUpperCase(),
                createdAt: new Date().toISOString()
            });

            setNewProject('');
            setShowForm(false);
            alert("Project Created Successfully");
        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProject = async (projectId, projectName) => {
        if (!confirm(`Are you sure you want to delete project "${projectName}"?`)) return;

        try {
            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('projects').doc(projectId).delete();
        } catch (error) {
            console.error(error);
            alert("Error deleting project: " + error.message);
        }
    };

    const startEditing = (project) => {
        setEditingId(project.id);
        setEditName(project.name);
    };

    const saveEdit = async (projectId) => {
        if (!editName || !editName.trim()) return alert("Project name cannot be empty.");
        try {
            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('projects').doc(projectId).update({
                name: editName.trim().toUpperCase()
            });
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
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-800 to-purple-600 flex items-center justify-center shadow-sm">
                        <Briefcase className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-white leading-none">
                            Projects
                        </h2>
                    </div>
                </div>

                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex-shrink-0 bg-slate-800 dark:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-slate-900 dark:hover:bg-slate-500 transition-colors shadow-sm"
                    >
                        <Plus size={15} /> Add Project
                    </button>
                )}
            </div>

            {/* ── Create Project Form ── */}
            {showForm && (
                <div className="p-3 rounded-xl border mb-4 bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-600">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">➕ Create New Project</h3>
                        <button onClick={() => { setShowForm(false); setNewProject(''); }} className="text-xs text-slate-500 flex items-center gap-1 hover:text-red-500 transition-colors"><X size={14} /> Close</button>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2">
                        <input
                            type="text"
                            placeholder="Project Name"
                            value={newProject}
                            onChange={e => setNewProject(e.target.value)}
                            className={inputCls + " flex-1 uppercase"}
                        />
                        <button
                            onClick={handleCreateProject}
                            disabled={loading || !newProject.trim()}
                            className="bg-slate-800 dark:bg-slate-600 hover:bg-slate-900 dark:hover:bg-slate-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-bold transition-colors shadow-sm"
                        >
                            {loading ? 'Saving...' : <><Plus size={15} /> Add</>}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Project List Table ── */}
            {projects.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-700/80 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <tr>
                                <th className="px-1.5 py-1.5 font-bold">Project Name</th>
                                <th className="px-1.5 py-1.5 text-right font-bold w-20">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                            {projects.map(p => (
                                <tr key={p.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors ${editingId === p.id ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                                    <td className="px-1.5 py-1 font-semibold text-slate-800 dark:text-white uppercase">
                                        {editingId === p.id ? (
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                className={inputCls + " py-1 text-xs uppercase w-full max-w-xs"}
                                                autoFocus
                                            />
                                        ) : (
                                            p.name
                                        )}
                                    </td>
                                    <td className="px-1.5 py-1 text-right">
                                        {editingId === p.id ? (
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => saveEdit(p.id)} className="p-1.5 text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-900/30 rounded transition-colors" title="Save">
                                                    <Save size={16} />
                                                </button>
                                                <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Cancel">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => startEditing(p)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors" title="Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteProject(p.id, p.name)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors" title="Delete Project">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ProjectManager;
