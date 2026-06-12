import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import ExcelJS from 'exceljs';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, serverTimestamp, onSnapshot, writeBatch } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { firebaseApp, appId } from '../lib/firebase';
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

import {
    Upload,
    Truck,
    Package,
    FileText,
    Users,
    LogOut,
    Plus,
    Filter,
    ChevronDown,
    ChevronUp,
    Trash2,
    Printer,
    X,
    FileImage as ImageIcon,
    ChevronLeft,
    ChevronRight,
    Camera,
    Edit,
    User as UserIcon,
    Clock,
    Settings,
    Save,
    AlertTriangle,
    Eye,
    EyeOff,
    List,
    CheckSquare,
    ArrowUpDown,
    Minus,
    BookOpen,
    TrendingUp,
    Download,
    Database
} from 'lucide-react';

const ROLES = {
    ADMIN: 'admin',
    FACTORY: 'factory',
    SITE: 'site',
    DUAL: 'dual'
};

const STATUS = {
    DRAFT: 'Draft',
    READY_PROD: 'Ready for Production',
    PROD_APPROVAL: 'Factory Approval Pending',
    READY_DISPATCH: 'Ready for Dispatch',
    INSTALL_APPROVAL: 'Installation Approval Pending',
    READY_HANDOVER: 'Ready for Handover',
    COMPLETED: 'Handover Completed'
};

const DEFAULT_STATUS_BUTTONS = [
    { label: 'Mark Ready for Prod', value: STATUS.READY_PROD },
    { label: 'Mark Ready for Dispatch', value: STATUS.READY_DISPATCH },
    { label: 'Mark Ready for Handover', value: STATUS.READY_HANDOVER },
    { label: 'Complete', value: STATUS.COMPLETED },
];

// --- Helper Functions ---

const loadXLSX = () => {
    return new Promise((resolve, reject) => {
        if (window.XLSX) return resolve(window.XLSX);
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        script.onload = () => resolve(window.XLSX);
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

const compressImage = (file, maxWidth = 1200) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const elem = document.createElement('canvas');
                const scaleFactor = maxWidth / img.width;
                elem.width = maxWidth;
                elem.height = img.height * scaleFactor;
                const ctx = elem.getContext('2d');
                ctx.drawImage(img, 0, 0, elem.width, elem.height);
                resolve(elem.toDataURL('image/jpeg', 0.7));
            };
        };
    });
};

// ── Firebase Storage image handling ──────────────────────────────────────────
// Images are stored as files in Storage (full + small thumbnail) and only their
// download URLs are kept in Firestore, so sign documents stay tiny.

const THUMB_WIDTH = 200;

const dataUrlToThumb = (dataUrl, maxWidth = THUMB_WIDTH) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => reject(new Error('Could not decode image for thumbnail'));
    img.src = dataUrl;
});

// Uploads a base64 data-URL as a full image + thumbnail under the given Storage
// path prefix. Returns { url, thumbUrl } download URLs. Throws if the full
// upload fails; a failed thumbnail falls back to the full image URL.
const uploadImagePair = async (dataUrl, pathPrefix) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullRef = storageRef(storage, `${pathPrefix}/${id}.jpg`);
    await uploadString(fullRef, dataUrl, 'data_url');
    const url = await getDownloadURL(fullRef);

    let thumbUrl = url;
    try {
        const thumbData = await dataUrlToThumb(dataUrl);
        const thumbRef = storageRef(storage, `${pathPrefix}/${id}_thumb.jpg`);
        await uploadString(thumbRef, thumbData, 'data_url');
        thumbUrl = await getDownloadURL(thumbRef);
    } catch (e) {
        console.warn('Thumbnail generation failed, using full image:', e);
    }
    return { url, thumbUrl };
};

const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsArrayBuffer(file);
    });
};

const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

// --- Components ---

const Loading = () => (
    <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-600">
        <div className="animate-spin mr-3">
            <Package size={24} />
        </div>
        Loading Admire Project Tracker...
    </div>
);

const Lightbox = ({ images, initialIndex = 0, onClose, onDelete, field, onUpdateRemark }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [remarkDraft, setRemarkDraft] = useState('');
    const [remarkSaving, setRemarkSaving] = useState(false);

    const next = (e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev + 1) % images.length); };
    const prev = (e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev - 1 + images.length) % images.length); };

    useEffect(() => {
        setRemarkDraft(images[currentIndex]?.remarks || '');
    }, [currentIndex, images]);

    if (!images || images.length === 0) return null;

    const currentImg = images[currentIndex];

    const saveRemark = async () => {
        if (!onUpdateRemark) return;
        setRemarkSaving(true);
        await onUpdateRemark(currentIndex, remarkDraft);
        setRemarkSaving(false);
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(currentIndex);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col justify-center items-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white p-2 z-10">
                <X size={32} />
            </button>

            {onDelete && (
                <button
                    onClick={handleDelete}
                    className="absolute top-4 right-20 text-red-400 hover:text-red-500 hover:bg-white/10 p-2 rounded-full transition z-10 cursor-pointer"
                    title="Delete Image"
                >
                    <Trash2 size={28} />
                </button>
            )}

            <div className="relative w-full max-w-4xl max-h-[85vh] flex items-center justify-center">
                <img
                    src={currentImg.url || currentImg}
                    alt="Full view"
                    className="max-w-full max-h-[80vh] object-contain shadow-2xl rounded-sm"
                    onClick={(e) => e.stopPropagation()}
                />

                {images.length > 1 && (
                    <>
                        <button
                            onClick={prev}
                            className="absolute left-2 md:left-[-60px] top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/20 hover:bg-white/10 p-3 rounded-full transition backdrop-blur-sm"
                        >
                            <ChevronLeft size={32} />
                        </button>
                        <button
                            onClick={next}
                            className="absolute right-2 md:right-[-60px] top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/20 hover:bg-white/10 p-3 rounded-full transition backdrop-blur-sm"
                        >
                            <ChevronRight size={32} />
                        </button>
                    </>
                )}
            </div>

            <div className="absolute bottom-6 left-0 right-0 text-center text-white/80 pointer-events-none px-4">
                <p className="font-bold text-lg mb-2">{(currentImg.stages?.join(', ') || currentImg.stage) || 'Image Preview'}</p>

                <div className="flex items-center justify-center gap-6 text-sm opacity-80 mb-2">
                    <span>{currentIndex + 1} of {images.length}</span>
                    {currentImg.timestamp && (
                        <span className="flex items-center gap-1">
                            <Clock size={14} /> {new Date(currentImg.timestamp).toLocaleString()}
                        </span>
                    )}
                    {currentImg.uploadedBy && (
                        <span className="flex items-center gap-1">
                            <UserIcon size={14} /> {currentImg.uploadedBy}
                        </span>
                    )}
                </div>

                {field === 'siteImages' && (
                    <div className="pointer-events-auto mt-3 flex items-start gap-2 justify-center">
                        <textarea
                            rows={3}
                            className="text-xs bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder:text-white/40 w-72 focus:outline-none focus:border-white/40 resize-none"
                            placeholder="Add remarks (optional)..."
                            value={remarkDraft}
                            onChange={e => setRemarkDraft(e.target.value)}
                            onBlur={saveRemark}
                            onClick={e => e.stopPropagation()}
                        />
                        {remarkSaving && <span className="text-xs text-white/50 mt-1">Saving...</span>}
                    </div>
                )}
            </div>
        </div>
    );
};

const UploadModal = ({ isOpen, onClose, onUpload, type, stages, defaultStage }) => {
    const [items, setItems] = useState([]); // [{id, file, stages: [], preview}]
    const [uploading, setUploading] = useState(false);

    const defaultSt = defaultStage || (stages && stages.length > 0 ? stages[0] : '');

    useEffect(() => {
        if (isOpen) setItems([]);
    }, [isOpen]);

    if (!isOpen) return null;

    const addFiles = (fileList) => {
        const newItems = Array.from(fileList).map(file => ({
            id: Math.random().toString(36).slice(2),
            file,
            stages: defaultSt ? [defaultSt] : [],
            preview: URL.createObjectURL(file),
            remarks: '',
        }));
        setItems(prev => [...prev, ...newItems]);
    };

    const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));
    const toggleItemStage = (id, stage) => setItems(prev => prev.map(i => {
        if (i.id !== id) return i;
        const next = i.stages.includes(stage) ? i.stages.filter(s => s !== stage) : [...i.stages, stage];
        return { ...i, stages: next };
    }));
    const updateItemRemark = (id, value) => setItems(prev => prev.map(i => i.id !== id ? i : { ...i, remarks: value }));

    const handleSubmit = async () => {
        if (items.length === 0) return;
        setUploading(true);
        await onUpload(items.map(i => ({ file: i.file, stages: i.stages, remarks: i.remarks })));
        setUploading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Add {type} Photos</h3>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700"><X size={18} /></button>
                </div>

                {/* File pickers — always visible so user can add more */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <label className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 cursor-pointer hover:bg-indigo-100 active:bg-indigo-200 transition select-none">
                        <Camera size={22} className="text-indigo-500" />
                        <span className="text-sm font-semibold text-indigo-700">Take Photo</span>
                        <input type="file" accept="image/*" capture="environment" className="hidden"
                            onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
                    </label>
                    <label className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 active:bg-slate-200 transition select-none">
                        <ImageIcon size={22} className="text-slate-400" />
                        <span className="text-sm font-semibold text-slate-600">From Gallery</span>
                        <input type="file" accept="image/*" multiple className="hidden"
                            onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
                    </label>
                </div>

                {/* Pending images list */}
                {items.length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto mb-4 pr-1">
                        {items.map(item => (
                            <div key={item.id} className="bg-slate-50 p-2 rounded-lg border">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <img src={item.preview} className="h-10 w-10 object-cover rounded border flex-shrink-0 bg-white" alt="" />
                                    <span className="flex-1 text-xs text-slate-600 truncate min-w-0">{item.file.name}</span>
                                    <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 flex-shrink-0 p-0.5"><X size={13} /></button>
                                </div>
                                {stages && stages.length > 0 && (
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 pl-1">
                                        {stages.map(s => (
                                            <label key={s} className="flex items-center gap-1.5 cursor-pointer select-none">
                                                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${item.stages.includes(s) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}
                                                    onClick={() => toggleItemStage(item.id, s)}>
                                                    {item.stages.includes(s) && <CheckSquare size={9} className="text-white" />}
                                                </span>
                                                <span className="text-[11px] text-slate-600" onClick={() => toggleItemStage(item.id, s)}>{s}</span>
                                            </label>
                                        ))}
                                        {item.stages.length === 0 && <span className="text-[11px] text-amber-500 italic">Select at least one stage</span>}
                                    </div>
                                )}
                                {type === 'Site' && (
                                    <textarea
                                        rows={2}
                                        placeholder="Remarks (optional)"
                                        value={item.remarks}
                                        onChange={e => updateItemRemark(item.id, e.target.value)}
                                        className="mt-1.5 w-full text-xs border border-slate-200 rounded px-2 py-1 text-slate-600 placeholder:text-slate-400 focus:outline-none focus:border-indigo-300 resize-none"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium text-sm">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        disabled={items.length === 0 || uploading}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2 text-sm"
                    >
                        {uploading ? <span className="animate-spin"><Package size={15} /></span> : <Upload size={15} />}
                        {items.length > 0 ? `Upload ${items.length} Photo${items.length > 1 ? 's' : ''}` : 'Upload'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const BOQSettingsModal = ({ boq, onClose }) => {
    const [name, setName] = useState(boq.name);
    const [factoryStages, setFactoryStages] = useState(boq.factoryStages || []);
    const [siteStages, setSiteStages] = useState(boq.siteStages || []);
    const [statusButtons, setStatusButtons] = useState(boq.statusButtons || DEFAULT_STATUS_BUTTONS);
    const [newFactoryStage, setNewFactoryStage] = useState('');
    const [newSiteStage, setNewSiteStage] = useState('');
    const [saving, setSaving] = useState(false);

    const handleAddStage = (type) => {
        if (type === 'factory' && newFactoryStage.trim()) {
            setFactoryStages([...factoryStages, newFactoryStage.trim()]);
            setNewFactoryStage('');
        }
        if (type === 'site' && newSiteStage.trim()) {
            setSiteStages([...siteStages, newSiteStage.trim()]);
            setNewSiteStage('');
        }
    };

    const handleRemoveStage = (type, index) => {
        if (type === 'factory') {
            setFactoryStages(factoryStages.filter((_, i) => i !== index));
        }
        if (type === 'site') {
            setSiteStages(siteStages.filter((_, i) => i !== index));
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id), {
                name,
                factoryStages,
                siteStages,
                statusButtons: statusButtons.filter(b => b.label.trim() && b.value.trim())
            });
            onClose();
        } catch (e) {
            console.error(e);
            alert("Failed to save settings");
        }
        setSaving(false);
    };

    const handleDeleteBOQ = async () => {
        if (!window.confirm(`CRITICAL WARNING: This will delete BOQ "${boq.name}" and ALL ${boq.stats?.total || 0} signs inside it. This cannot be undone. Are you sure?`)) return;

        setSaving(true);
        try {
            const signsRef = collection(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'signs');
            const snapshot = await getDocs(signsRef);
            const batch = writeBatch(db);

            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id));

            window.location.reload();
        } catch (e) {
            console.error("Delete failed", e);
            alert("Delete failed: " + e.message);
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-white z-[80] overflow-y-auto">
            <div className="max-w-2xl mx-auto p-6">
                <div className="flex justify-between items-center mb-8 border-b pb-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2"><Settings className="text-slate-400" /> BOQ Settings</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X /></button>
                </div>

                <div className="space-y-8">
                    <section>
                        <label className="block text-sm font-bold text-slate-700 mb-2">BOQ Name</label>
                        <input
                            className="w-full border p-2 rounded-lg text-lg"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </section>

                    <div className="grid md:grid-cols-2 gap-8">
                        <section className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                            <h3 className="font-bold text-orange-800 mb-4 flex items-center gap-2"><Package size={18} /> Factory Stages</h3>
                            <div className="space-y-2 mb-4">
                                {factoryStages.map((stage, i) => (
                                    <div key={i} className="flex justify-between items-center bg-white p-2 rounded border shadow-sm">
                                        <span className="text-sm">{stage}</span>
                                        <button onClick={() => handleRemoveStage('factory', i)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                                    </div>
                                ))}
                                {factoryStages.length === 0 && <p className="text-xs text-orange-400 italic">No custom stages (Using default)</p>}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    placeholder="New Stage Name"
                                    className="flex-1 text-sm p-2 border rounded"
                                    value={newFactoryStage}
                                    onChange={e => setNewFactoryStage(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddStage('factory')}
                                />
                                <button onClick={() => handleAddStage('factory')} className="bg-orange-200 text-orange-800 p-2 rounded hover:bg-orange-300"><Plus size={18} /></button>
                            </div>
                        </section>

                        <section className="bg-green-50 p-4 rounded-xl border border-green-100">
                            <h3 className="font-bold text-green-800 mb-4 flex items-center gap-2"><Truck size={18} /> Site Stages</h3>
                            <div className="space-y-2 mb-4">
                                {siteStages.map((stage, i) => (
                                    <div key={i} className="flex justify-between items-center bg-white p-2 rounded border shadow-sm">
                                        <span className="text-sm">{stage}</span>
                                        <button onClick={() => handleRemoveStage('site', i)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                                    </div>
                                ))}
                                {siteStages.length === 0 && <p className="text-xs text-green-400 italic">No custom stages (Using default)</p>}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    placeholder="New Stage Name"
                                    className="flex-1 text-sm p-2 border rounded"
                                    value={newSiteStage}
                                    onChange={e => setNewSiteStage(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddStage('site')}
                                />
                                <button onClick={() => handleAddStage('site')} className="bg-green-200 text-green-800 p-2 rounded hover:bg-green-300"><Plus size={18} /></button>
                            </div>
                        </section>
                    </div>

                    <section className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <h3 className="font-bold text-indigo-800 mb-1 flex items-center gap-2"><List size={18} /> Status Workflow Buttons</h3>
                        <p className="text-xs text-indigo-600 mb-4">Customise the bulk-action buttons shown when items are selected. The last button gets green styling.</p>
                        <div className="space-y-2 mb-4">
                            <div className="grid grid-cols-2 gap-2 px-1 mb-1">
                                <span className="text-[10px] font-bold uppercase text-indigo-500">Button Label</span>
                                <span className="text-[10px] font-bold uppercase text-indigo-500">Status Value</span>
                            </div>
                            {statusButtons.map((btn, i) => (
                                <div key={i} className="flex items-center gap-2 bg-white p-2 rounded border shadow-sm">
                                    <input
                                        className="flex-1 text-sm border rounded p-1.5 min-w-0 focus:ring-1 focus:ring-indigo-400 outline-none"
                                        placeholder="e.g. Mark Ready for Prod"
                                        value={btn.label}
                                        onChange={e => {
                                            const updated = [...statusButtons];
                                            updated[i] = { ...updated[i], label: e.target.value };
                                            setStatusButtons(updated);
                                        }}
                                    />
                                    <input
                                        className="flex-1 text-sm border rounded p-1.5 min-w-0 focus:ring-1 focus:ring-indigo-400 outline-none"
                                        placeholder="e.g. Ready for Production"
                                        value={btn.value}
                                        onChange={e => {
                                            const updated = [...statusButtons];
                                            updated[i] = { ...updated[i], value: e.target.value };
                                            setStatusButtons(updated);
                                        }}
                                    />
                                    <button onClick={() => setStatusButtons(statusButtons.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0">
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            {statusButtons.length === 0 && <p className="text-xs text-indigo-400 italic">No buttons configured — defaults will be used.</p>}
                        </div>
                        <button
                            onClick={() => setStatusButtons([...statusButtons, { label: '', value: '' }])}
                            className="flex items-center gap-1.5 text-sm text-indigo-700 hover:text-indigo-900 font-semibold"
                        >
                            <Plus size={15} /> Add Button
                        </button>
                    </section>

                    <section className="pt-8 border-t">
                        <h3 className="text-red-600 font-bold mb-2 flex items-center gap-2"><AlertTriangle size={20} /> Danger Zone</h3>
                        <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex justify-between items-center">
                            <div className="text-sm text-red-800">
                                <p className="font-bold">Delete this BOQ</p>
                                <p>Once deleted, it will be gone forever. Please be certain.</p>
                            </div>
                            <button
                                onClick={handleDeleteBOQ}
                                disabled={saving}
                                className="bg-red-600 text-white px-4 py-2 rounded font-bold hover:bg-red-700 disabled:opacity-50"
                            >
                                Delete BOQ
                            </button>
                        </div>
                    </section>
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-end gap-3 md:static md:bg-transparent md:border-0 md:mt-8">
                    <button onClick={onClose} className="px-6 py-2 text-slate-600 font-medium">Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving && <span className="animate-spin"><Package size={16} /></span>}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Login Component Removed since App handles Authentication ---

const Dashboard = ({ user, onViewBOQ, onManageUsers, onLogout }) => {
    const [boqs, setBOQs] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editBOQ, setEditBOQ] = useState(null); // {id, name}
    const [deleteBOQ, setDeleteBOQ] = useState(null); // {id, name}
    const [newBOQName, setNewBOQName] = useState('');

    useEffect(() => {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'boqs'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const boqList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBOQs(boqList);
        }, (err) => console.error("Error fetching boqs", err));
        return () => unsubscribe();
    }, []);

    const handleUpdateBOQName = async () => {
        if (!editBOQ || !editBOQ.name.trim()) return;
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', editBOQ.id), {
                name: editBOQ.name
            });
            setEditBOQ(null);
        } catch (e) {
            console.error("Error updating BOQ name", e);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteBOQ) return;
        try {
            // This only deletes the BOQ doc, not the sub-collections. 
            // In a real app, you'd want a recursive delete or a cloud function.
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', deleteBOQ.id));
            setDeleteBOQ(null);
        } catch (e) {
            console.error("Error deleting BOQ", e);
        }
    };

    const getRoleBadge = (role) => {
        switch (role) {
            case ROLES.ADMIN: return <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">Admin</span>;
            case ROLES.FACTORY: return <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">Factory</span>;
            case ROLES.SITE: return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Site</span>;
            default: return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">User</span>;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <main className="max-w-7xl mx-auto px-3 py-4 sm:p-6">
                {/* ── Page header ── */}
                <div className="flex justify-between items-center mb-4 sm:mb-8">
                    <h2 className="text-lg sm:text-2xl font-bold text-slate-800">BOQ Dashboard</h2>
                    {user.role === ROLES.ADMIN && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-indigo-600 active:bg-indigo-800 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition text-sm font-semibold"
                        >
                            <Plus size={15} /> New BOQ
                        </button>
                    )}
                </div>

                {/* ── Mobile card list (< md) ── */}
                <div className="md:hidden space-y-2.5">
                    {boqs.map(boq => (
                        <div
                            key={boq.id}
                            className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden active:bg-slate-50 transition-colors"
                            onClick={() => onViewBOQ(boq)}
                        >
                            {/* Card top: icon + name + actions */}
                            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                                <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600 flex-shrink-0">
                                    <FileText size={16} />
                                </div>
                                <span className="flex-1 font-bold text-slate-800 text-sm truncate">{boq.name}</span>
                                {user.role === ROLES.ADMIN && (
                                    <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => setEditBOQ({ id: boq.id, name: boq.name })}
                                            className="p-2 rounded-full text-slate-400 active:bg-indigo-50 active:text-indigo-600 transition"
                                            title="Rename BOQ"
                                        >
                                            <Edit size={14} />
                                        </button>
                                        <button
                                            onClick={() => setDeleteBOQ({ id: boq.id, name: boq.name })}
                                            className="p-2 rounded-full text-slate-400 active:bg-red-50 active:text-red-600 transition"
                                            title="Delete BOQ"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Stats grid 2×2 */}
                            <div className="grid grid-cols-4 border-t border-slate-100 divide-x divide-slate-100">
                                <div className="flex flex-col items-center py-2.5">
                                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Total</span>
                                    <span className="text-base font-bold text-slate-700 tabular-nums">{boq.stats?.total || 0}</span>
                                </div>
                                <div className="flex flex-col items-center py-2.5">
                                    <span className="text-[10px] text-orange-400 font-medium uppercase tracking-wide">Pending</span>
                                    <span className="text-base font-bold text-orange-500 tabular-nums">{boq.stats?.pending || 0}</span>
                                </div>
                                <div className="flex flex-col items-center py-2.5">
                                    <span className="text-[10px] text-blue-400 font-medium uppercase tracking-wide">Produced</span>
                                    <span className="text-base font-bold text-blue-500 tabular-nums">{boq.stats?.manufactured || 0}</span>
                                </div>
                                <div className="flex flex-col items-center py-2.5">
                                    <span className="text-[10px] text-green-500 font-medium uppercase tracking-wide">Installed</span>
                                    <span className="text-base font-bold text-green-500 tabular-nums">{boq.stats?.installed || 0}</span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {boqs.length === 0 && (
                        <div className="py-16 text-center text-slate-400">
                            <Package size={40} className="mx-auto mb-3 opacity-40" />
                            <p className="text-sm">No BOQs found. Tap <span className="font-semibold text-indigo-600">New BOQ</span> to create one.</p>
                        </div>
                    )}
                </div>

                {/* ── Desktop table (≥ md) ── */}
                <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-3 w-1/3">BOQ Name</th>
                                <th className="px-4 py-3 text-center w-24">Total</th>
                                <th className="px-4 py-3 text-center w-24">Pending</th>
                                <th className="px-4 py-3 text-center w-24 text-blue-600">Produced</th>
                                <th className="px-4 py-3 text-center w-24 text-green-600">Installed</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {boqs.map(boq => (
                                <tr
                                    key={boq.id}
                                    className="hover:bg-slate-50 transition cursor-pointer group"
                                    onClick={() => onViewBOQ(boq)}
                                >
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-indigo-50 p-2 rounded text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
                                                <FileText size={16} />
                                            </div>
                                            <span className="font-bold text-slate-800 text-sm">{boq.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-slate-600 text-sm">{boq.stats?.total || 0}</td>
                                    <td className="px-4 py-3 text-center font-bold text-orange-600 text-sm">{boq.stats?.pending || 0}</td>
                                    <td className="px-4 py-3 text-center font-bold text-blue-600 text-sm">{boq.stats?.manufactured || 0}</td>
                                    <td className="px-4 py-3 text-center font-bold text-green-600 text-sm">{boq.stats?.installed || 0}</td>
                                    <td className="px-6 py-3 text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            {user.role === ROLES.ADMIN && (
                                                <>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setEditBOQ({ id: boq.id, name: boq.name }); }}
                                                        className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition"
                                                        title="Rename BOQ"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setDeleteBOQ({ id: boq.id, name: boq.name }); }}
                                                        className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition"
                                                        title="Delete BOQ"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                            <button className="text-indigo-600 font-bold text-xs hover:underline ml-2">View Details →</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {boqs.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="py-20 text-center text-slate-400">
                                        <Package size={48} className="mx-auto mb-4 opacity-50" />
                                        <p>No BOQs found. Create one to get started.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </main>

            {/* ── Add BOQ modal ── */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
                    <div className="bg-white rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-md">
                        <h3 className="text-lg font-bold mb-4">Add New BOQ</h3>
                        <input
                            autoFocus
                            type="text"
                            className="w-full border-2 border-slate-200 focus:border-indigo-400 outline-none p-3 rounded-xl mb-4 text-sm transition-colors"
                            placeholder="BOQ Name"
                            value={newBOQName}
                            onChange={e => setNewBOQName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && newBOQName.trim() && document.getElementById('create-boq-btn').click()}
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 text-slate-600 font-semibold bg-slate-100 rounded-xl active:bg-slate-200">Cancel</button>
                            <button
                                id="create-boq-btn"
                                onClick={async () => {
                                    if (!newBOQName.trim()) return;
                                    try {
                                        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'boqs'), {
                                            name: newBOQName,
                                            createdAt: serverTimestamp(),
                                            createdBy: user.username,
                                            factoryStages: [],
                                            siteStages: [],
                                            stats: { total: 0, pending: 0, manufactured: 0, installed: 0, handedover: 0 }
                                        });
                                        setShowAddModal(false);
                                        setNewBOQName('');
                                    } catch (e) { console.error(e); }
                                }}
                                className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl active:bg-indigo-800"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit name modal ── */}
            {editBOQ && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
                    <div className="bg-white rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-md">
                        <h3 className="text-lg font-bold mb-4">Rename BOQ</h3>
                        <input
                            autoFocus
                            type="text"
                            className="w-full border-2 border-indigo-100 focus:border-indigo-500 outline-none p-3 rounded-xl mb-6 transition-all text-sm"
                            value={editBOQ.name}
                            onChange={e => setEditBOQ({ ...editBOQ, name: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && handleUpdateBOQName()}
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setEditBOQ(null)} className="flex-1 py-2.5 text-slate-600 font-semibold bg-slate-100 rounded-xl active:bg-slate-200">Cancel</button>
                            <button onClick={handleUpdateBOQName} className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl active:bg-indigo-800">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete confirmation modal ── */}
            {deleteBOQ && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
                    <div className="bg-white rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-md">
                        <div className="flex items-center gap-3 text-red-600 mb-3">
                            <AlertTriangle size={22} />
                            <h3 className="text-lg font-bold">Delete BOQ?</h3>
                        </div>
                        <p className="text-slate-600 mb-6 text-sm">
                            Are you sure you want to delete <span className="font-bold text-slate-800">"{deleteBOQ.name}"</span>?
                            This cannot be undone and will remove all associated sign records.
                        </p>
                        <div className="flex gap-2">
                            <button onClick={() => setDeleteBOQ(null)} className="flex-1 py-2.5 text-slate-600 font-semibold bg-slate-100 rounded-xl active:bg-slate-200">Keep it</button>
                            <button onClick={handleConfirmDelete} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl active:bg-red-800">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ... EditSignModal (Same as before) ...
const EditSignModal = ({ sign, columns, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (sign) {
            const initialData = {};
            columns.forEach(col => {
                if (!col.isId) { // Skip ID as it usually shouldn't change
                    initialData[col.key] = sign[col.key] || '';
                }
            });
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData(initialData);
        }
    }, [sign, columns]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = () => {
        onUpdate(sign._id, formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-xl font-bold">Edit Sign Details</h3>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 grid grid-cols-2 gap-4">
                    {columns.filter(c => !c.isId && c.visible).map(col => (
                        <div key={col.key} className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{col.label}</label>
                            <input
                                name={col.key}
                                value={formData[col.key] || ''}
                                onChange={handleChange}
                                className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    ))}
                </div>
                <div className="p-6 border-t bg-slate-50 rounded-b-xl flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
                    <button onClick={handleSubmit} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700">Save Changes</button>
                </div>
            </div>
        </div>
    );
};

// ... BOQManager (Same as before) ...
const BOQManager = ({ boq: initialBoq, user, onBack }) => {
    // Keep BOQ metadata in sync with Firestore so stage/settings changes
    // made by any admin are reflected immediately without a page refresh.
    const [liveBoqMeta, setLiveBoqMeta] = useState({});
    const boq = useMemo(() => ({ ...initialBoq, ...liveBoqMeta }), [initialBoq, liveBoqMeta]);

    useEffect(() => {
        const boqRef = doc(db, 'artifacts', appId, 'public', 'data', 'boqs', initialBoq.id);
        return onSnapshot(boqRef, (snap) => {
            if (snap.exists()) {
                const { name, factoryStages, siteStages, statusButtons, columns } = snap.data();
                setLiveBoqMeta({ name, factoryStages, siteStages, statusButtons, columns });
            }
        });
    }, [initialBoq.id]);

    const [signs, setSigns] = useState([]);
    const [viewMode, setViewMode] = useState('table');
    const [importConfig, setImportConfig] = useState(null);
    const [selectedSigns, setSelectedSigns] = useState(new Set());
    const [filters, setFilters] = useState({});
    const [dateFilters, setDateFilters] = useState({ siteFrom: '', siteTo: '', factoryFrom: '', factoryTo: '' });
    const [dateFilterOpen, setDateFilterOpen] = useState(null); // 'site' | 'factory' | null
    const [sortConfig, setSortConfig] = useState(null);
    const [loadingImport, setLoadingImport] = useState(false);
    const [columns, setColumns] = useState([]);
    const [lightboxImages, setLightboxImages] = useState(null);
    const [editingSign, setEditingSign] = useState(null);
    const [showSettings, setShowSettings] = useState(false);

    // New state for Column Visibility
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const [visibleColumnKeys, setVisibleColumnKeys] = useState(new Set());

    // Upload Modal State
    const [uploadModal, setUploadModal] = useState({ isOpen: false, sign: null, isFactory: false });

    // Sticky Stage State
    const [lastFactoryStage, setLastFactoryStage] = useState('');
    const [lastSiteStage, setLastSiteStage] = useState('');

    // ID multi-select filter
    const [idFilter, setIdFilter] = useState(new Set());
    const [idSearch, setIdSearch] = useState('');
    const [showIdDropdown, setShowIdDropdown] = useState(false);
    const idDropdownRef = React.useRef(null);

    // Active filter dropdown key for column multi-select filters
    const [activeFilterKey, setActiveFilterKey] = useState(null);
    const [filterDropdownLeft, setFilterDropdownLeft] = useState(0);
    const [dateFilterLeft, setDateFilterLeft] = useState(0);

    const openFilterDropdown = (key, e) => {
        if (activeFilterKey === key) { setActiveFilterKey(null); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        const containerRect = idDropdownRef.current?.getBoundingClientRect();
        setFilterDropdownLeft(rect.left - (containerRect?.left || 0));
        setActiveFilterKey(key);
        setShowIdDropdown(false);
        setDateFilterOpen(null);
    };

    const openDateFilter = (type, e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const containerRect = idDropdownRef.current?.getBoundingClientRect();
        setDateFilterLeft(rect.left - (containerRect?.left || 0));
        setDateFilterOpen(prev => prev === type ? null : type);
        setActiveFilterKey(null);
        setShowIdDropdown(false);
    };

    useEffect(() => {
        if (!showIdDropdown && !activeFilterKey && !dateFilterOpen) return;
        const handler = (e) => {
            if (idDropdownRef.current && !idDropdownRef.current.contains(e.target)) {
                setShowIdDropdown(false);
                setActiveFilterKey(null);
                setDateFilterOpen(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showIdDropdown, activeFilterKey, dateFilterOpen]);

    // Tab state
    const [activeTab, setActiveTab] = useState('items');

    // Image migration progress ({ done, total, errors } while running, else null)
    const [migration, setMigration] = useState(null);

    useEffect(() => {
        if (!boq) return;
        const signsRef = collection(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'signs');
        const unsubscribe = onSnapshot(signsRef, (snapshot) => {
            const loadedSigns = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
            setSigns(loadedSigns);

            if (user.role === ROLES.ADMIN) {
                const stats = loadedSigns.reduce((acc, sign) => {
                    acc.total++;
                    if (sign.status === STATUS.DRAFT || sign.status === STATUS.READY_PROD) acc.pending++;
                    if (sign.status === STATUS.READY_DISPATCH) acc.manufactured++;
                    if (sign.status === STATUS.COMPLETED) acc.handedover++;
                    if (sign.status === STATUS.READY_HANDOVER) acc.installed++;
                    return acc;
                }, { total: 0, pending: 0, manufactured: 0, installed: 0, handedover: 0 });

                updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id), { stats });
            }
        });
        return () => unsubscribe();
    }, [boq.id, user.role]);

    useEffect(() => {
        if (boq.columns) {
            setColumns(boq.columns);
            // Initialize visible columns to all currently visible columns from config
            if (visibleColumnKeys.size === 0) {
                const initialKeys = new Set(boq.columns.filter(c => c.visible).map(c => c.key));
                setVisibleColumnKeys(initialKeys);
            }
        }
    }, [boq, visibleColumnKeys.size]);

    const toggleColumnVisibility = (key) => {
        const newSet = new Set(visibleColumnKeys);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setVisibleColumnKeys(newSet);
    };

    // ... Import Handlers & Logic (Same as before) ...
    const findHeaderRow = (rows) => {
        let bestIdx = 0;
        let maxCols = 0;
        const scanLimit = Math.min(rows.length, 25);

        for (let i = 0; i < scanLimit; i++) {
            const row = rows[i];
            let colCount = 0;
            if (Array.isArray(row)) {
                colCount = row.filter(c => c !== undefined && c !== null && String(c).trim() !== '').length;
            } else if (row instanceof HTMLTableRowElement) {
                colCount = Array.from(row.children).filter(c => c.innerText.trim().length > 0).length;
            }

            if (colCount > maxCols) {
                maxCols = colCount;
                bestIdx = i;
            }
        }
        return bestIdx;
    };

    const parseSheetData = (workbook) => {
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const json = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        const headerIdx = findHeaderRow(json);
        const headers = json[headerIdx].map(h => String(h).trim());

        const rows = json.slice(headerIdx + 1);

        const mappedData = rows.map(row => {
            const rowObj = {};
            let hasData = false;

            headers.forEach((h, i) => {
                if (!h) return; // Skip empty header columns
                const val = row[i];
                if (val !== undefined && val !== null) {
                    const strVal = String(val).trim();
                    if (strVal !== '') {
                        rowObj[h] = strVal;
                        hasData = true;
                    }
                }
            });
            return hasData ? rowObj : null;
        }).filter(r => r !== null);

        return { headers: headers.filter(h => h), data: mappedData };
    };

    const processHTMLImport = async (fileList) => {
        let htmlFile = null;
        let imageFiles = {};

        Array.from(fileList).forEach(f => {
            if (f.name.toLowerCase().endsWith('.htm') || f.name.toLowerCase().endsWith('.html')) {
                if (!htmlFile || f.name.includes('sheet')) htmlFile = f;
            } else if (f.type.startsWith('image/')) {
                const baseName = f.name.substring(0, f.name.lastIndexOf('.'));
                imageFiles[f.name.toLowerCase()] = f;
                imageFiles[baseName.toLowerCase()] = f;
            }
        });

        if (!htmlFile) {
            alert("No HTML file found. Please select .htm file.");
            return null;
        }

        const text = await htmlFile.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const table = doc.querySelector('table');

        if (!table) return null;

        const allRows = Array.from(table.querySelectorAll('tr'));

        const headerIndex = findHeaderRow(allRows);

        const headers = Array.from(allRows[headerIndex].children).map(th => th.innerText.trim().replace(/\s+/g, ' '));
        const dataRows = allRows.slice(headerIndex + 1);

        const data = await Promise.all(dataRows.map(async row => {
            const cells = Array.from(row.children);
            const rowData = {};
            let hasData = false;

            for (let index = 0; index < cells.length; index++) {
                const cell = cells[index];
                const header = headers[index];
                if (header) {
                    const img = cell.querySelector('img');
                    if (img) {
                        const src = img.getAttribute('src');
                        if (src) {
                            const srcName = src.split('/').pop().toLowerCase();
                            const srcBase = srcName.substring(0, srcName.lastIndexOf('.'));
                            const imageFile = imageFiles[srcName] || imageFiles[srcBase];

                            if (imageFile) {
                                const base64 = await compressImage(imageFile, 600);
                                rowData[header] = base64;
                                rowData[header + '_isImage'] = true;
                                hasData = true;
                            }
                        }
                    } else {
                        const txt = cell.innerText.trim();
                        if (txt) {
                            rowData[header] = txt;
                            hasData = true;
                        }
                    }
                }
            }
            return hasData ? rowData : null;
        }));

        const validData = data.filter(r => r !== null);
        if (validData.length === 0) {
            alert("Parsed 0 valid rows. Check if your HTML structure matches standard Excel export.");
        }
        return { headers, data: validData };
    };

    const processImportWithExcelJS = async (file) => {
        try {
            const buffer = await readFileAsArrayBuffer(file);
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);

            const worksheet = workbook.getWorksheet(1);
            if (!worksheet) return null;

            const rows = [];
            const maxCols = Math.min(worksheet.actualColumnCount || 50, 100);

            worksheet.eachRow({ includeEmpty: true }, (row) => {
                const values = [];
                for (let i = 1; i <= maxCols; i++) {
                    const cell = row.getCell(i);
                    const val = cell.value;
                    let finalText = "";
                    let isFormulaImage = false;

                    if (val !== null && val !== undefined) {
                        if (typeof val === 'object') {
                            if (val.error) {
                                finalText = "";
                            } else if (val.formula || val.sharedFormula) {
                                // Catch both IMAGE() and HYPERLINK() formulas
                                const formulaStr = String(val.formula || val.sharedFormula);
                                const imageMatch = formulaStr.match(/(?:IMAGE|HYPERLINK)\(\s*["']([^"']+)["']/i);

                                if (imageMatch && imageMatch[1]) {
                                    finalText = imageMatch[1];
                                    isFormulaImage = true;
                                } else if (val.hyperlink) {
                                    finalText = val.hyperlink;
                                    isFormulaImage = true;
                                } else {
                                    finalText = val.result !== undefined ? String(val.result) : "";
                                }
                            } else if (val.hyperlink) {
                                // Catch native Excel hyperlink objects
                                finalText = val.hyperlink;
                                isFormulaImage = true;
                            } else {
                                finalText = val.text || val.result || String(val);
                            }
                        } else {
                            finalText = String(val);
                        }
                    }
                    values.push({ text: finalText, isFormulaImage });
                }
                rows.push(values);
            });

            const findHeaderIdx = (rws) => {
                let bestIdx = 0; let maxCols = 0;
                for (let i = 0; i < Math.min(rws.length, 25); i++) {
                    const colCount = rws[i].filter(c => c.text && c.text.trim() !== '').length;
                    if (colCount > maxCols) { maxCols = colCount; bestIdx = i; }
                }
                return bestIdx;
            };

            const headerIdx = findHeaderIdx(rows);
            if (headerIdx === -1) return null;

            const headers = rows[headerIdx].map(h => String(h.text || "").trim());
            const dataRows = rows.slice(headerIdx + 1);

            const imageMap = {};
            const rowImageMap = {};

            // Keep traditional floating image extraction as a fallback
            worksheet.getImages().forEach(img => {
                const imgData = workbook.getImage(img.imageId);
                if (imgData && imgData.buffer) {
                    const tl = img.range.tl;
                    const br = img.range.br || tl;
                    // Use a slight offset to ensure we catch the cell that primarily contains the image
                    const r = Math.floor(tl.row);
                    const c = Math.floor(tl.col);
                    const ext = imgData.extension || 'png';
                    const base64 = `data:image/${ext};base64,${arrayBufferToBase64(imgData.buffer)}`;

                    imageMap[`${r}_${c}`] = base64;
                    // Also map to the row as a fallback
                    if (!rowImageMap[r]) rowImageMap[r] = [];
                    rowImageMap[r].push(base64);
                }
            });

            const mappedData = [];
            // Expanded keyword list to ensure column detection
            const imageKeywords = ['artwork', 'image', 'photo', 'picture', 'visual', 'sign', 'link'];

            for (let i = 0; i < dataRows.length; i++) {
                const rowObj = {};
                let hasData = false;
                const actualRowIdx = headerIdx + 1 + i;

                headers.forEach((h, colIdx) => {
                    if (!h) return;

                    const cellData = dataRows[i][colIdx];
                    let imgSource = imageMap[`${actualRowIdx}_${colIdx}`];

                    // Priority 1: Did we extract an explicit formula/hyperlink URL?
                    if (!imgSource && cellData && cellData.isFormulaImage) {
                        imgSource = cellData.text;
                    }

                    const isImageCol = imageKeywords.some(kw => h.toLowerCase().includes(kw));

                    // Priority 2: Is it just a raw URL pasted as plain text in an image column?
                    if (!imgSource && cellData && cellData.text) {
                        const textStr = cellData.text.trim();
                        if (isImageCol && /^https?:\/\//i.test(textStr)) {
                            imgSource = textStr;
                        }
                    }

                    // Priority 3: Grab stray floating images attached to the row
                    if (!imgSource && isImageCol && rowImageMap[actualRowIdx] && rowImageMap[actualRowIdx].length > 0) {
                        imgSource = rowImageMap[actualRowIdx].shift();
                    }

                    if (imgSource) {
                        rowObj[h] = imgSource;
                        rowObj[h + '_isImage'] = true;
                        hasData = true;
                    } else if (cellData && cellData.text) {
                        const trimmed = cellData.text.trim();
                        if (trimmed !== '') {
                            rowObj[h] = trimmed;
                            hasData = true;
                        }
                    }
                });
                if (hasData) mappedData.push(rowObj);
            }

            return { headers: headers.filter(h => h), data: mappedData };
        } catch (e) {
            console.error("ExcelJS import failed, falling back to SheetJS", e);
            return processImportWithSheetJS(file);
        }
    };

    const processImportWithSheetJS = async (file) => {
        try {
            const XLSX = await loadXLSX();
            const data = await readFileAsArrayBuffer(file);
            const workbook = XLSX.read(data, { type: 'array' });
            return parseSheetData(workbook);
        } catch (e) {
            console.error("SheetJS import failed", e);
            alert("Failed to parse file. Ensure it is a valid Excel or CSV file.");
            return null;
        }
    };

    const handleFileUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setLoadingImport(true);

        try {
            let result = null;
            const firstFile = files[0];

            if (files.length > 1 || firstFile.name.toLowerCase().endsWith('.htm') || firstFile.name.toLowerCase().endsWith('.html')) {
                result = await processHTMLImport(files);
            } else if (firstFile.name.toLowerCase().endsWith('.xlsx')) {
                result = await processImportWithExcelJS(firstFile);
            } else {
                // Use SheetJS for both Excel (.xls) and CSV for robust parsing
                result = await processImportWithSheetJS(firstFile);
            }

            if (result && result.data.length > 0) {
                setImportConfig(result);
            } else {
                alert("No valid data found in file.");
            }

        } catch (err) {
            console.error(err);
            alert("Import failed. See console for details.");
        } finally {
            setLoadingImport(false);
        }
    };

    const confirmImport = async (uniqueIdCol, displayCols, filterCols) => {
        // --- NEW: Duplicate Check ---
        const rawIds = importConfig.data
            .map(row => row[uniqueIdCol])
            .filter(val => val !== undefined && val !== null && String(val).trim() !== '')
            .map(val => String(val).trim());

        const seen = new Set();
        const duplicates = new Set();

        for (const id of rawIds) {
            if (seen.has(id)) {
                duplicates.add(id);
            } else {
                seen.add(id);
            }
        }

        if (duplicates.size > 0) {
            alert(`Cannot Import: Duplicate values found in Unique ID column.\n\nDuplicates: ${Array.from(duplicates).slice(0, 15).join(', ')}${duplicates.size > 15 ? '...' : ''}\n\nPlease ensure every row has a unique identifier.`);
            return;
        }
        // -----------------------------

        const newColumns = importConfig.headers.map(h => ({
            key: h,
            visible: displayCols.includes(h),
            isId: h === uniqueIdCol,
            isFilter: filterCols.includes(h),
            label: h
        }));

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id), {
            columns: newColumns
        });
        setColumns(newColumns);

        const imageColumns = importConfig.headers.filter(h =>
            importConfig.data.some(row => row[h + '_isImage'])
        );

        for (const row of importConfig.data) {
            if (!row[uniqueIdCol]) continue;

            const signId = row[uniqueIdCol].toString().replace(/[^a-zA-Z0-9]/g, '_');

            let artworkImages = [];
            imageColumns.forEach(col => {
                if (row[col + '_isImage'] && row[col]) {
                    artworkImages.push({ url: row[col], stage: 'Artwork', timestamp: new Date().toISOString() });
                }
            });

            if (artworkImages.length === 0 && row['Artwork']) {
                artworkImages.push({ url: row['Artwork'], stage: 'Artwork', timestamp: new Date().toISOString() });
            }

            // Move imported base64 artwork to Storage; on failure keep the
            // inline base64 so the import never loses an image.
            for (const img of artworkImages) {
                if (img.url && img.url.startsWith('data:')) {
                    try {
                        const up = await uploadImagePair(img.url, `boqs/${boq.id}/signs/${signId}`);
                        img.url = up.url;
                        img.thumbUrl = up.thumbUrl;
                    } catch (e) {
                        console.error(`Storage upload failed for ${signId}, keeping inline image:`, e);
                    }
                }
            }

            const cleanRow = { ...row };
            imageColumns.forEach(col => delete cleanRow[col]);
            if (cleanRow['Artwork']) delete cleanRow['Artwork'];

            const signData = {
                ...cleanRow,
                status: STATUS.DRAFT,
                createdAt: serverTimestamp(),
                history: [],
                artworkImages: artworkImages,
                factoryImages: [],
                siteImages: []
            };

            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'signs', signId), signData);
        }

        setImportConfig(null);
    };

    const updateStatus = async (signIds, newStatus) => {
        const ids = Array.from(signIds);
        for (const id of ids) {
            try {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'signs', id), {
                    status: newStatus,
                    history: serverTimestamp()
                });
            } catch (e) {
                console.error("Status update error", e);
            }
        }
        setSelectedSigns(new Set());
    };

    const batchDelete = async (signIds) => {
        if (!window.confirm(`Are you sure you want to delete ${signIds.size} signs?`)) return;
        const ids = Array.from(signIds);
        for (const id of ids) {
            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'signs', id));
            } catch (e) {
                console.error(e);
                alert("Error deleting sign: " + id);
            }
        }
        setSelectedSigns(new Set());
    };

    const handleUpdateSign = async (signId, updatedData) => {
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'signs', signId), updatedData);
        } catch (e) {
            console.error("Update failed", e);
            alert("Failed to update sign.");
        }
    };

    const handleDeleteImage = async (signId, field, imageIndex) => {
        if (!window.confirm("Are you sure you want to delete this image?")) return;

        try {
            const signRef = doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'signs', signId);
            const signDoc = await getDoc(signRef);

            if (signDoc.exists()) {
                const data = signDoc.data();
                const images = data[field] || [];
                const newImages = images.filter((_, i) => i !== imageIndex);

                await updateDoc(signRef, { [field]: newImages });
                setLightboxImages(null); // Close lightbox after deletion to prevent errors
            }
        } catch (e) {
            console.error("Error deleting image", e);
            alert("Failed to delete image.");
        }
    };

    const handleUpdateRemark = async (signId, field, imageIndex, newRemark) => {
        try {
            const signRef = doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'signs', signId);
            const signDoc = await getDoc(signRef);
            if (signDoc.exists()) {
                const images = [...(signDoc.data()[field] || [])];
                if (images[imageIndex]) {
                    images[imageIndex] = { ...images[imageIndex], remarks: newRemark };
                    await updateDoc(signRef, { [field]: images });
                    setLightboxImages(prev => {
                        if (!prev) return prev;
                        const updatedImages = [...prev.images];
                        if (updatedImages[imageIndex]) {
                            updatedImages[imageIndex] = { ...updatedImages[imageIndex], remarks: newRemark };
                        }
                        return { ...prev, images: updatedImages };
                    });
                }
            }
        } catch (e) {
            console.error("Error updating remark", e);
        }
    };

    const handleToggleStage = async (sign, stage, isFactory) => {
        const checksField = isFactory ? 'factoryStageChecks' : 'siteStageChecks';
        const current = sign[checksField] || {};
        const isDone = current[stage]?.checked;
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'signs', sign._id), {
            [checksField]: {
                ...current,
                [stage]: isDone ? { checked: false } : { checked: true, by: user.username, at: new Date().toISOString() }
            }
        });
    };

    const handleUploadRequest = (sign, isFactory) => {
        const stages = isFactory ? boq.factoryStages : boq.siteStages;
        if (stages && stages.length > 0) {
            setUploadModal({ isOpen: true, sign, isFactory });
        } else {
            // Trigger hidden file input directly if no stages defined
            const id = `file-${isFactory ? 'fact' : 'site'}-${sign._id}`;
            document.getElementById(id).click();
        }
    };

    const handleImageUpload = async (uploads) => {
        // uploads: [{file, stages: []}, ...]
        const { sign, isFactory } = uploadModal;
        if (!sign || !uploads.length) return;

        const lastUploadStages = uploads[uploads.length - 1].stages;
        const lastStage = lastUploadStages?.[0] || '';
        if (isFactory) setLastFactoryStage(lastStage);
        else setLastSiteStage(lastStage);

        for (const { file, stages, remarks } of uploads) {
            const finalStages = stages?.length ? stages : [isFactory ? 'General Production' : 'Installation'];
            await executeUpload(sign, file, finalStages, isFactory, remarks || '');
        }
    };

    const executeUpload = async (sign, file, stages, isFactory, remarks = '') => {
        if (!file) return;
        const signRef = doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'signs', sign._id);
        const field = isFactory ? 'factoryImages' : 'siteImages';

        // Compress and fetch fresh sign state concurrently so sequential uploads see the latest image list
        const [compressed, freshSnap] = await Promise.all([
            compressImage(file, 1200),
            getDoc(signRef),
        ]);
        const freshSign = freshSnap.exists() ? { _id: sign._id, ...freshSnap.data() } : sign;

        const artImages = freshSign.artworkImages || [];
        const hasArtworks = artImages.length > 0;

        // Upload to Storage; if that fails (e.g. flaky connection on site) fall
        // back to storing the base64 inline so the photo is never lost. The
        // admin migration tool moves any such inline images to Storage later.
        let url = compressed;
        let thumbUrl = null;
        try {
            ({ url, thumbUrl } = await uploadImagePair(compressed, `boqs/${boq.id}/signs/${sign._id}`));
        } catch (e) {
            console.error('Storage upload failed, storing image inline:', e);
        }

        const newImage = {
            url,
            ...(thumbUrl ? { thumbUrl } : {}),
            stages,
            uploadedBy: user.username,
            timestamp: new Date().toISOString(),
            ...(isFactory ? {} : { remarks }),
        };

        const currentImages = freshSign[field] || [];
        const newImagesList = [...currentImages, newImage];
        let updates = { [field]: newImagesList };

        if (isFactory) {
            updates.status = hasArtworks ? STATUS.PROD_APPROVAL : STATUS.READY_DISPATCH;
        } else {
            updates.status = STATUS.INSTALL_APPROVAL;
        }

        // Auto-mark uploaded stages as checked so stage dots turn green immediately
        const checksField = isFactory ? 'factoryStageChecks' : 'siteStageChecks';
        const stagesArray = Array.isArray(stages) ? stages : (stages ? [stages] : []);
        if (stagesArray.length > 0) {
            const currentChecks = freshSign[checksField] || {};
            const updatedChecks = { ...currentChecks };
            stagesArray.forEach(stage => {
                if (!updatedChecks[stage]?.checked) {
                    updatedChecks[stage] = { checked: true, by: user.username, at: new Date().toISOString() };
                }
            });
            updates[checksField] = updatedChecks;
        }

        await updateDoc(signRef, updates);
    };

    // ── Image migration: inline base64 → Firebase Storage ───────────────────
    const legacyImageCount = useMemo(() =>
        signs.reduce((n, s) =>
            n + ['artworkImages', 'factoryImages', 'siteImages'].reduce((m, f) =>
                m + (s[f] || []).filter(img => img?.url?.startsWith('data:')).length, 0), 0),
        [signs]);

    // Downloads this BOQ's complete data (incl. inline base64 images) as a
    // JSON file — the local safety copy taken before migrating.
    const downloadBoqBackup = () => {
        const payload = {
            exportedAt: new Date().toISOString(),
            boqId: boq.id,
            boq: { ...boq },
            signs,
        };
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const a = document.createElement('a');
        const name = String(boq.name || boq.id).replace(/[^a-zA-Z0-9-_]+/g, '_');
        a.href = URL.createObjectURL(blob);
        a.download = `boq-backup-${name}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    };

    // Migrates every inline base64 image in this BOQ to Storage.
    // Designed around a slow Firestore channel: all Storage uploads run in a
    // small worker pool, and the (tiny, URL-only) document updates are then
    // committed in a handful of writeBatch calls instead of one write per sign.
    // A JSON backup of the project is auto-downloaded before anything starts.
    // Idempotent — re-running skips anything already migrated.
    const MIGRATION_CONCURRENCY = 5;

    const migrateImagesToStorage = async () => {
        if (migration) return;
        if (!window.confirm(
            `Migrate ${legacyImageCount} inline image(s) in this project to Firebase Storage?\n\n` +
            `A JSON backup of this project will download automatically before the migration starts — keep that file safe.\n\n` +
            `Keep this tab open until it finishes.`
        )) return;

        // Local safety copy of the original data, always taken first
        downloadBoqBackup();

        const FIELDS = ['artworkImages', 'factoryImages', 'siteImages'];
        const targets = signs.filter(s => FIELDS.some(f => (s[f] || []).some(img => img?.url?.startsWith('data:'))));
        setMigration({ done: 0, total: targets.length, errors: 0, phase: 'upload' });

        // Phase A — upload images to Storage (no Firestore writes yet)
        const results = [];
        let done = 0;
        let errors = 0;

        const processSign = async (sign) => {
            try {
                const updates = {};
                for (const f of FIELDS) {
                    const imgs = sign[f] || [];
                    if (!imgs.some(img => img?.url?.startsWith('data:'))) continue;
                    updates[f] = await Promise.all(imgs.map(async (img) => {
                        if (!img?.url?.startsWith('data:')) return img;
                        const up = await uploadImagePair(img.url, `boqs/${boq.id}/signs/${sign._id}`);
                        return { ...img, url: up.url, thumbUrl: up.thumbUrl };
                    }));
                }
                results.push({ id: sign._id, updates });
            } catch (e) {
                console.error(`Upload failed for sign ${sign._id} (sign left unchanged):`, e);
                errors++;
            } finally {
                done++;
                setMigration(m => (m ? { ...m, done, errors } : m));
            }
        };

        const queue = [...targets];
        await Promise.all(Array.from({ length: MIGRATION_CONCURRENCY }, async () => {
            while (queue.length > 0) {
                await processSign(queue.shift());
            }
        }));

        // Phase B — commit all sign updates in batched writes
        setMigration(m => (m ? { ...m, phase: 'save' } : m));
        try {
            for (let i = 0; i < results.length; i += 400) {
                const batch = writeBatch(db);
                results.slice(i, i + 400).forEach(({ id, updates }) => {
                    batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'signs', id), updates);
                });
                await batch.commit();
            }
        } catch (e) {
            console.error('Saving migrated image URLs failed:', e);
            alert('Images were uploaded to Storage, but saving to the database failed. Your data is unchanged — run the migration again to retry.');
            setMigration(null);
            return;
        }

        alert(errors === 0
            ? `Migration complete — ${results.length} item(s) moved to Storage.`
            : `Migration finished: ${results.length} item(s) migrated, ${errors} failed and were left unchanged. Run again to retry the failed ones.`);
        setMigration(null);
    };

    const toggleFilterValue = (key, value) => {
        const current = new Set(filters[key] || []);
        if (current.has(value)) current.delete(value); else current.add(value);
        setFilters({ ...filters, [key]: current });
    };

    const filteredSigns = useMemo(() => {
        let data = [...signs];
        Object.keys(filters).forEach(key => {
            const vals = filters[key];
            if (!vals || vals.size === 0) return;
            if (key === '_factoryStage') {
                data = data.filter(s => [...vals].some(v => s.factoryStageChecks?.[v]?.checked));
            } else if (key === '_siteStage') {
                data = data.filter(s => [...vals].some(v => s.siteStageChecks?.[v]?.checked));
            } else {
                data = data.filter(s => vals.has(s[key]));
            }
        });

        // Date range filters for image timestamps
        const { siteFrom, siteTo, factoryFrom, factoryTo } = dateFilters;
        if (siteFrom || siteTo) {
            const from = siteFrom ? new Date(siteFrom).getTime() : 0;
            const to = siteTo ? new Date(siteTo + 'T23:59:59').getTime() : Infinity;
            data = data.filter(s => (s.siteImages || []).some(img => {
                const t = img.timestamp ? new Date(img.timestamp).getTime() : 0;
                return t >= from && t <= to;
            }));
        }
        if (factoryFrom || factoryTo) {
            const from = factoryFrom ? new Date(factoryFrom).getTime() : 0;
            const to = factoryTo ? new Date(factoryTo + 'T23:59:59').getTime() : Infinity;
            data = data.filter(s => (s.factoryImages || []).some(img => {
                const t = img.timestamp ? new Date(img.timestamp).getTime() : 0;
                return t >= from && t <= to;
            }));
        }
        if (idFilter.size > 0) {
            const idKey = columns.find(c => c.isId)?.key;
            if (idKey) data = data.filter(s => idFilter.has(String(s[idKey])));
        }

        if (sortConfig) {
            const getVal = (sign, key) => {
                if (key === '_siteImageDate') {
                    const imgs = sign.siteImages || [];
                    return imgs.length ? imgs.reduce((latest, img) => img.timestamp > latest ? img.timestamp : latest, '') : '';
                }
                if (key === '_factoryImageDate') {
                    const imgs = sign.factoryImages || [];
                    return imgs.length ? imgs.reduce((latest, img) => img.timestamp > latest ? img.timestamp : latest, '') : '';
                }
                return sign[key] ?? '';
            };
            data.sort((a, b) => {
                const av = getVal(a, sortConfig.key);
                const bv = getVal(b, sortConfig.key);
                if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
                if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return data;
    }, [signs, filters, dateFilters, idFilter, sortConfig, columns]);

    const uniqueValues = useMemo(() => {
        const map = {};
        columns.filter(c => c.isFilter).forEach(col => {
            map[col.key] = [...new Set(signs.map(s => s[col.key]).filter(Boolean))].sort();
        });
        const btnValues = (boq.statusButtons || DEFAULT_STATUS_BUTTONS).map(b => b.value);
        const signStatuses = signs.map(s => s.status).filter(Boolean);
        map['status'] = [...new Set([STATUS.DRAFT, ...btnValues, ...signStatuses])].sort();
        return map;
    }, [signs, columns, boq.statusButtons]);

    // Determine if user can delete specific image types
    const canDeleteImage = (field) => {
        if (user.role === ROLES.ADMIN) return true;
        if (user.role === ROLES.FACTORY && field === 'factoryImages') return true;
        if (user.role === ROLES.SITE && field === 'siteImages') return true;
        if (user.role === ROLES.DUAL && (field === 'factoryImages' || field === 'siteImages')) return true;
        return false;
    };

    // Render columns based on visibility settings (but always include ID)
    const activeColumns = columns.filter(c => (c.isId || visibleColumnKeys.has(c.key)) && c.visible);

    // Optimised per-column widths: size each data column to fit its uploaded data on one line,
    // while letting multi-word headers wrap. Columns with short data (e.g. "2.0 DIA") stay narrow
    // even when the header label is long ("PIER SIZE IN METER"), freeing space for other columns.
    const colWidths = useMemo(() => {
        const sample = filteredSigns.length > 400 ? filteredSigns.slice(0, 400) : filteredSigns;
        const map = {};
        activeColumns.forEach(col => {
            let dataChars = 0;
            for (const s of sample) {
                const v = s[col.key];
                if (v != null && v !== '') dataChars = Math.max(dataChars, String(v).length);
            }
            // Header wraps at spaces, so only its longest word constrains the width.
            const headerWord = String(col.label).split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0);
            const chars = Math.max(dataChars, headerWord, 3);
            // ~7.5px/char + cell padding, clamped so nothing is too cramped or too greedy.
            map[col.key] = Math.round(Math.min(Math.max(chars * 7.5 + 22, 56), 170));
        });
        return map;
    }, [filteredSigns, activeColumns]);

    // Shared column template for the mobile "table-like" view: a single fixed header row up top,
    // and every card aligns its values under the same columns. Images/stages span full width.
    const mobileIdCol = activeColumns.find(c => c.isId);
    const mobileBodyCols = activeColumns.filter(c => !c.isId && c.visible).slice(0, 6);
    const mobileGridTemplate = [
        user.role === ROLES.ADMIN && '1rem',                  // selection checkbox
        mobileIdCol && 'minmax(40px,1.1fr)',                  // ID
        ...mobileBodyCols.map(() => 'minmax(36px,1fr)'),      // data columns
        'minmax(48px,0.9fr)',                                 // status
        user.role === ROLES.ADMIN && '2.5rem',               // actions
    ].filter(Boolean).join(' ');

    if (viewMode === 'print') {
        return (
            <PrintView
                boq={boq}
                signs={filteredSigns}
                columns={activeColumns}
                onClose={() => setViewMode('table')}
            />
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {lightboxImages && (
                <Lightbox
                    images={lightboxImages.images}
                    initialIndex={lightboxImages.index}
                    onClose={() => setLightboxImages(null)}
                    field={lightboxImages.field}
                    onDelete={
                        canDeleteImage(lightboxImages.field)
                            ? (idx) => handleDeleteImage(lightboxImages.signId, lightboxImages.field, idx)
                            : null
                    }
                    onUpdateRemark={
                        lightboxImages.field === 'siteImages'
                            ? (idx, remark) => handleUpdateRemark(lightboxImages.signId, lightboxImages.field, idx, remark)
                            : null
                    }
                />
            )}

            {editingSign && (
                <EditSignModal
                    sign={editingSign}
                    columns={columns}
                    onClose={() => setEditingSign(null)}
                    onUpdate={handleUpdateSign}
                />
            )}

            {showSettings && (
                <BOQSettingsModal
                    boq={boq}
                    onClose={() => setShowSettings(false)}
                />
            )}

            <UploadModal
                isOpen={uploadModal.isOpen}
                onClose={() => setUploadModal({ ...uploadModal, isOpen: false })}
                onUpload={handleImageUpload}
                type={uploadModal.isFactory ? "Factory" : "Site"}
                stages={uploadModal.isFactory ? boq.factoryStages : boq.siteStages}
                defaultStage={uploadModal.isFactory ? lastFactoryStage : lastSiteStage}
            />

            {/* ── Header ── */}
            <header className="relative bg-white border-b px-3 py-2 flex items-center justify-between shadow-sm z-30 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 active:bg-slate-200 rounded-full text-slate-500 flex-shrink-0">
                        <ChevronUp className="rotate-[-90deg]" size={18} />
                    </button>
                    <div className="min-w-0">
                        <h2 className="text-base font-bold text-slate-800 truncate leading-tight">{boq.name}</h2>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                            <span>{signs.length} items</span>
                            <span>·</span>
                            <span>{filteredSigns.length} filtered</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Column visibility */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColumnSelector(!showColumnSelector)}
                            className={`p-2 rounded-lg transition ${showColumnSelector ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-100 active:bg-slate-200'}`}
                            title="Show/Hide Columns"
                        >
                            <Eye size={16} />
                        </button>
                        {showColumnSelector && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border p-2 z-50 animate-in fade-in slide-in-from-top-2">
                                <div className="text-xs font-bold text-slate-400 uppercase px-2 py-1 mb-1">Visible Columns</div>
                                <div className="max-h-60 overflow-y-auto space-y-1">
                                    {columns.filter(c => c.visible).map(col => (
                                        <button
                                            key={col.key}
                                            onClick={() => !col.isId && toggleColumnVisibility(col.key)}
                                            className={`w-full text-left px-3 py-2 rounded flex items-center justify-between text-sm ${col.isId ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50'}`}
                                        >
                                            <span className={visibleColumnKeys.has(col.key) || col.isId ? 'text-slate-800 font-medium' : 'text-slate-400'}>{col.label}</span>
                                            {visibleColumnKeys.has(col.key) || col.isId ? <Eye size={14} className="text-indigo-500" /> : <EyeOff size={14} className="text-slate-300" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    {user.role === ROLES.ADMIN && (
                        <button
                            onClick={downloadBoqBackup}
                            className="p-2 text-slate-500 hover:bg-slate-100 active:bg-slate-200 rounded-lg"
                            title="Download project backup (JSON)"
                        >
                            <Download size={16} />
                        </button>
                    )}
                    {user.role === ROLES.ADMIN && legacyImageCount > 0 && (
                        <button
                            onClick={migrateImagesToStorage}
                            disabled={!!migration}
                            className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 rounded-lg disabled:opacity-50"
                            title={`Migrate ${legacyImageCount} inline image(s) to Firebase Storage`}
                        >
                            <Database size={16} />
                        </button>
                    )}
                    {user.role === ROLES.ADMIN && (
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 text-slate-500 hover:bg-slate-100 active:bg-slate-200 rounded-lg"
                            title="BOQ Settings"
                        >
                            <Settings size={16} />
                        </button>
                    )}
                    <button
                        onClick={() => setViewMode('print')}
                        className="p-2 text-slate-500 hover:bg-slate-100 active:bg-slate-200 rounded-lg"
                    >
                        <Printer size={16} />
                    </button>
                    {user.role === ROLES.ADMIN && (
                        <div className="relative overflow-hidden cursor-pointer bg-indigo-600 active:bg-indigo-800 text-white p-2 rounded-lg flex items-center gap-1 transition">
                            {loadingImport ? (
                                <span className="animate-spin"><Package size={16} /></span>
                            ) : <Upload size={16} />}
                            <span className="hidden sm:inline text-sm font-medium">Import</span>
                            <input
                                type="file"
                                multiple
                                onChange={handleFileUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                accept=".csv, .html, .htm, .xlsx, .xls, .png, .jpg, .jpeg"
                            />
                        </div>
                    )}
                </div>
            </header>

            {/* ── Image migration progress ── */}
            {migration && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs font-medium text-amber-800 flex items-center gap-2">
                    <span className="animate-spin"><Package size={14} /></span>
                    {migration.phase === 'save'
                        ? 'Saving to database…'
                        : `Uploading images to Storage… ${migration.done} / ${migration.total} items`}
                    {migration.errors > 0 && <span className="text-red-600 font-bold">({migration.errors} failed)</span>}
                    <span className="text-amber-600 font-normal">— keep this tab open</span>
                </div>
            )}

            {/* ── Tabs ── */}
            <div className="bg-white border-b flex items-center px-3 gap-0">
                <button
                    onClick={() => setActiveTab('items')}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${activeTab === 'items' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Items
                </button>
                <button
                    onClick={() => setActiveTab('dpr')}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${activeTab === 'dpr' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    DPR
                </button>
            </div>

            {/* ── Filter Bar — horizontally scrollable pills on mobile ── */}
            {activeTab === 'items' && (() => {
                const idCol = columns.find(c => c.isId);
                const allIds = idCol ? [...new Set(signs.map(s => String(s[idCol.key])).filter(Boolean))].sort() : [];
                const searchedIds = allIds.filter(id => id.toLowerCase().includes(idSearch.toLowerCase()));
                const allSelected = searchedIds.length > 0 && searchedIds.every(id => idFilter.has(id));
                const toggleId = (id) => { const n = new Set(idFilter); n.has(id) ? n.delete(id) : n.add(id); setIdFilter(n); };
                const toggleAll = () => {
                    const n = new Set(idFilter);
                    if (allSelected) searchedIds.forEach(id => n.delete(id));
                    else searchedIds.forEach(id => n.add(id));
                    setIdFilter(n);
                };
                return (
                <div className="bg-white border-b relative" ref={idDropdownRef}>
                <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                    {/* Status pill */}
                    <button
                        onClick={(e) => openFilterDropdown('status', e)}
                        className={`flex-shrink-0 flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full border text-xs font-medium transition whitespace-nowrap ${
                            (filters.status?.size || 0) > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                    >
                        <Filter size={11} className="flex-shrink-0" />
                        <span>{(filters.status?.size || 0) > 0 ? `${filters.status.size} Status${filters.status.size > 1 ? 'es' : ''}` : 'All Statuses'}</span>
                        <ChevronDown size={11} />
                    </button>

                    {/* ID multi-select trigger pill */}
                    {idCol && (
                        <button
                            onClick={() => { setShowIdDropdown(v => !v); setActiveFilterKey(null); }}
                            className={`flex-shrink-0 flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-full border text-xs font-medium whitespace-nowrap transition ${
                                idFilter.size > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                        >
                            <Filter size={11} className="flex-shrink-0" />
                            <span>{idCol.label}:</span>
                            <span className="font-semibold">{idFilter.size > 0 ? `${idFilter.size} selected` : 'All'}</span>
                            <ChevronDown size={11} />
                        </button>
                    )}

                    {/* Factory stage filter */}
                    {boq.factoryStages?.length > 0 && (
                        <button
                            onClick={(e) => openFilterDropdown('_factoryStage', e)}
                            className={`flex-shrink-0 flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-full border text-xs font-medium whitespace-nowrap transition ${
                                (filters._factoryStage?.size || 0) > 0 ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                        >
                            <span className="opacity-70">Factory:</span>
                            <span className="font-semibold">{(filters._factoryStage?.size || 0) > 0 ? `${filters._factoryStage.size} selected` : 'All'}</span>
                            <ChevronDown size={11} />
                        </button>
                    )}

                    {/* Site stage filter */}
                    {boq.siteStages?.length > 0 && (
                        <button
                            onClick={(e) => openFilterDropdown('_siteStage', e)}
                            className={`flex-shrink-0 flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-full border text-xs font-medium whitespace-nowrap transition ${
                                (filters._siteStage?.size || 0) > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                        >
                            <span className="opacity-70">Site:</span>
                            <span className="font-semibold">{(filters._siteStage?.size || 0) > 0 ? `${filters._siteStage.size} selected` : 'All'}</span>
                            <ChevronDown size={11} />
                        </button>
                    )}

                    {/* Site date filter pill */}
                    {boq.siteStages?.length > 0 && (
                        <button
                            onClick={(e) => openDateFilter('site', e)}
                            className={`flex-shrink-0 flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-full border text-xs font-medium whitespace-nowrap transition ${
                                (dateFilters.siteFrom || dateFilters.siteTo) ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                        >
                            <Clock size={11} className="flex-shrink-0" />
                            <span className="opacity-70">Site Date:</span>
                            <span className="font-semibold">
                                {(dateFilters.siteFrom || dateFilters.siteTo)
                                    ? `${dateFilters.siteFrom || '…'} → ${dateFilters.siteTo || '…'}`
                                    : 'All'}
                            </span>
                            <ChevronDown size={11} />
                        </button>
                    )}

                    {/* Factory date filter pill */}
                    {boq.factoryStages?.length > 0 && (
                        <button
                            onClick={(e) => openDateFilter('factory', e)}
                            className={`flex-shrink-0 flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-full border text-xs font-medium whitespace-nowrap transition ${
                                (dateFilters.factoryFrom || dateFilters.factoryTo) ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                        >
                            <Clock size={11} className="flex-shrink-0" />
                            <span className="opacity-70">Factory Date:</span>
                            <span className="font-semibold">
                                {(dateFilters.factoryFrom || dateFilters.factoryTo)
                                    ? `${dateFilters.factoryFrom || '…'} → ${dateFilters.factoryTo || '…'}`
                                    : 'All'}
                            </span>
                            <ChevronDown size={11} />
                        </button>
                    )}

                    {/* Dynamic filter pills — exclude ID column to avoid duplication */}
                    {columns.filter(c => c.isFilter && !c.isId).map(col => (
                        <button
                            key={col.key}
                            onClick={(e) => openFilterDropdown(col.key, e)}
                            className={`flex-shrink-0 flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-full border text-xs font-medium whitespace-nowrap transition ${
                                (filters[col.key]?.size || 0) > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                        >
                            <span className="opacity-70">{col.label}:</span>
                            <span className="font-semibold">{(filters[col.key]?.size || 0) > 0 ? `${filters[col.key].size} selected` : 'All'}</span>
                            <ChevronDown size={11} />
                        </button>
                    ))}

                    {/* Clear button */}
                    {(Object.keys(filters).some(k => (filters[k]?.size || 0) > 0) || idFilter.size > 0 || dateFilters.siteFrom || dateFilters.siteTo || dateFilters.factoryFrom || dateFilters.factoryTo) && (
                        <button
                            onClick={() => { setFilters({}); setIdFilter(new Set()); setIdSearch(''); setActiveFilterKey(null); setDateFilters({ siteFrom: '', siteTo: '', factoryFrom: '', factoryTo: '' }); setDateFilterOpen(null); }}
                            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full border border-red-200 bg-red-50 text-red-600 text-xs font-semibold active:bg-red-100"
                        >
                            <X size={11} /> Clear
                        </button>
                    )}
                </div>

                {/* ID dropdown panel — rendered OUTSIDE overflow-x-auto to avoid clipping */}
                {showIdDropdown && idCol && (
                    <div className="absolute left-3 top-full mt-0 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                        <div className="p-2 border-b border-slate-100">
                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                                <Filter size={12} className="text-slate-400 flex-shrink-0" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search..."
                                    value={idSearch}
                                    onChange={e => setIdSearch(e.target.value)}
                                    className="flex-1 bg-transparent text-xs outline-none text-slate-700 placeholder-slate-400"
                                />
                                {idSearch && <button onClick={() => setIdSearch('')} className="text-slate-400 hover:text-slate-600"><X size={11} /></button>}
                            </div>
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                            <button
                                onClick={toggleAll}
                                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition text-left border-b border-slate-100"
                            >
                                <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${allSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                    {allSelected && <Minus size={10} className="text-white" />}
                                </span>
                                <span className="text-xs font-semibold text-slate-700">(Select All)</span>
                            </button>
                            {searchedIds.map(id => (
                                <button
                                    key={id}
                                    onClick={() => toggleId(id)}
                                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 transition text-left"
                                >
                                    <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${idFilter.has(id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                        {idFilter.has(id) && <CheckSquare size={10} className="text-white" />}
                                    </span>
                                    <span className="text-xs text-slate-700 truncate">{id}</span>
                                </button>
                            ))}
                            {searchedIds.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No matches</p>}
                        </div>
                        {idFilter.size > 0 && (
                            <div className="p-2 border-t border-slate-100">
                                <button
                                    onClick={() => { setIdFilter(new Set()); setShowIdDropdown(false); }}
                                    className="w-full text-xs text-red-600 font-semibold py-1.5 rounded-lg hover:bg-red-50 transition"
                                >
                                    Clear Filter
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Multi-select filter dropdown panel */}
                {activeFilterKey && (() => {
                    const isFactoryStage = activeFilterKey === '_factoryStage';
                    const isSiteStage = activeFilterKey === '_siteStage';
                    const opts = activeFilterKey === 'status'
                        ? (uniqueValues['status'] || [])
                        : isFactoryStage
                            ? (boq.factoryStages || [])
                            : isSiteStage
                                ? (boq.siteStages || [])
                                : (uniqueValues[activeFilterKey] || []);
                    const selected = filters[activeFilterKey] || new Set();
                    const allSel = opts.length > 0 && opts.every(o => selected.has(o));
                    const colorClass = isFactoryStage ? 'bg-orange-600 border-orange-600' : isSiteStage ? 'bg-green-600 border-green-600' : 'bg-indigo-600 border-indigo-600';
                    const toggleAll = () => {
                        if (allSel) setFilters({ ...filters, [activeFilterKey]: new Set() });
                        else setFilters({ ...filters, [activeFilterKey]: new Set(opts) });
                    };
                    return (
                        <div className="absolute top-full mt-0 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden" style={{ left: filterDropdownLeft }}>
                            <div className="max-h-52 overflow-y-auto">
                                <button
                                    onClick={toggleAll}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition text-left border-b border-slate-100"
                                >
                                    <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${allSel ? colorClass : 'border-slate-300 bg-white'}`}>
                                        {allSel && <Minus size={10} className="text-white" />}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-700">(Select All)</span>
                                </button>
                                {opts.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => toggleFilterValue(activeFilterKey, opt)}
                                        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 transition text-left"
                                    >
                                        <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${selected.has(opt) ? colorClass : 'border-slate-300 bg-white'}`}>
                                            {selected.has(opt) && <CheckSquare size={10} className="text-white" />}
                                        </span>
                                        <span className="text-xs text-slate-700 truncate">{opt}</span>
                                    </button>
                                ))}
                                {opts.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No options</p>}
                            </div>
                            {selected.size > 0 && (
                                <div className="p-2 border-t border-slate-100">
                                    <button
                                        onClick={() => { setFilters({ ...filters, [activeFilterKey]: new Set() }); setActiveFilterKey(null); }}
                                        className="w-full text-xs text-red-600 font-semibold py-1.5 rounded-lg hover:bg-red-50 transition"
                                    >
                                        Clear Filter
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* ── Date filter panels — rendered outside overflow-x-auto ── */}
                {dateFilterOpen === 'site' && (
                    <div className="absolute top-full mt-0 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-3" style={{ left: dateFilterLeft }}>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Site Photo Date Range</p>
                        <label className="block text-xs text-slate-600 mb-1">From</label>
                        <input type="date" value={dateFilters.siteFrom}
                            onChange={e => setDateFilters(p => ({ ...p, siteFrom: e.target.value }))}
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1 mb-2 focus:outline-none focus:border-green-400" />
                        <label className="block text-xs text-slate-600 mb-1">To</label>
                        <input type="date" value={dateFilters.siteTo}
                            onChange={e => setDateFilters(p => ({ ...p, siteTo: e.target.value }))}
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1 mb-2 focus:outline-none focus:border-green-400" />
                        {(dateFilters.siteFrom || dateFilters.siteTo) && (
                            <button onClick={() => setDateFilters(p => ({ ...p, siteFrom: '', siteTo: '' }))}
                                className="w-full text-xs text-red-500 hover:text-red-700 py-1 text-center">Clear dates</button>
                        )}
                    </div>
                )}
                {dateFilterOpen === 'factory' && (
                    <div className="absolute top-full mt-0 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-3" style={{ left: dateFilterLeft }}>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Factory Photo Date Range</p>
                        <label className="block text-xs text-slate-600 mb-1">From</label>
                        <input type="date" value={dateFilters.factoryFrom}
                            onChange={e => setDateFilters(p => ({ ...p, factoryFrom: e.target.value }))}
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1 mb-2 focus:outline-none focus:border-orange-400" />
                        <label className="block text-xs text-slate-600 mb-1">To</label>
                        <input type="date" value={dateFilters.factoryTo}
                            onChange={e => setDateFilters(p => ({ ...p, factoryTo: e.target.value }))}
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1 mb-2 focus:outline-none focus:border-orange-400" />
                        {(dateFilters.factoryFrom || dateFilters.factoryTo) && (
                            <button onClick={() => setDateFilters(p => ({ ...p, factoryFrom: '', factoryTo: '' }))}
                                className="w-full text-xs text-red-500 hover:text-red-700 py-1 text-center">Clear dates</button>
                        )}
                    </div>
                )}

                {/* ── Mobile-only sort bar ── */}
                <div className="md:hidden flex items-center gap-2 px-3 pb-1.5 border-t border-slate-100 pt-1.5">
                    <ArrowUpDown size={11} className="text-slate-400 flex-shrink-0" />
                    <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">Sort:</span>

                    {/* Column picker */}
                    <div className={`flex-1 flex items-center gap-1 pl-2 pr-0.5 py-1 rounded-full border text-xs font-medium whitespace-nowrap transition ${
                        sortConfig?.key ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                        <select
                            className="bg-transparent border-none focus:ring-0 text-xs font-medium cursor-pointer pr-1 w-full"
                            value={sortConfig?.key || ''}
                            onChange={e => setSortConfig({ key: e.target.value, direction: sortConfig?.direction || 'asc' })}
                        >
                            <option value="">No sort</option>
                            <option value="status">Status</option>
                            {activeColumns.map(col => (
                                <option key={col.key} value={col.key}>{col.label}</option>
                            ))}
                            {(boq.factoryStages || []).length > 0 && <option value="_factoryImageDate">Factory Photo Date</option>}
                            {(boq.siteStages || []).length > 0 && <option value="_siteImageDate">Site Photo Date</option>}
                        </select>
                    </div>

                    {/* Asc / Desc toggle */}
                    <button
                        onClick={() => setSortConfig(prev => ({
                            key: prev?.key || 'status',
                            direction: prev?.direction === 'asc' ? 'desc' : 'asc'
                        }))}
                        className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold transition active:scale-95 ${
                            sortConfig?.direction === 'desc'
                                ? 'bg-teal-50 border-teal-200 text-teal-700'
                                : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                        title="Toggle sort direction"
                    >
                        {sortConfig?.direction === 'desc'
                            ? <><ChevronDown size={11} /> DESC</>
                            : <><ChevronUp size={11} /> ASC</>
                        }
                    </button>
                </div>
            </div>
                ); // close return
            })()} {/* close IIFE */}

            {activeTab === 'items' && selectedSigns.size > 0 && user.role === ROLES.ADMIN && (
                <div className="bg-indigo-50 px-3 py-2 flex flex-col md:flex-row items-start md:items-center justify-between border-b border-indigo-100 gap-2">
                    <span className="text-sm text-indigo-800 font-medium">{selectedSigns.size} selected</span>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => updateStatus(selectedSigns, STATUS.DRAFT)}
                            className="text-xs bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 px-3 py-1 rounded flex items-center gap-1"
                            title="Reset to Draft"
                        >
                            ↩ Reset to Draft
                        </button>
                        <div className="w-px bg-indigo-200 mx-1 hidden md:block"></div>
                        {(boq.statusButtons || DEFAULT_STATUS_BUTTONS).map((btn, i, arr) => (
                            <button
                                key={i}
                                onClick={() => updateStatus(selectedSigns, btn.value)}
                                className={`text-xs bg-white border px-3 py-1 rounded ${
                                    i === arr.length - 1
                                        ? 'border-green-200 text-green-700 hover:bg-green-50'
                                        : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                        <div className="w-px bg-indigo-200 mx-2 hidden md:block"></div>
                        <button onClick={() => batchDelete(selectedSigns)} className="text-xs bg-white border border-red-200 text-red-700 px-3 py-1 rounded hover:bg-red-50 flex items-center gap-1"><Trash2 size={12} /> Delete</button>
                    </div>
                </div>
            )}

            {activeTab === 'items' && <div className="flex-1 overflow-auto relative bg-white">

                {/* ── Mobile fixed column header (< md) ── */}
                <div className="md:hidden sticky top-0 z-20 bg-slate-50/95 backdrop-blur border-b border-slate-200">
                    <div className="grid gap-x-2 px-3 py-1.5 items-end text-[8px] font-bold text-slate-400 uppercase tracking-wide"
                        style={{ gridTemplateColumns: mobileGridTemplate }}>
                        {user.role === ROLES.ADMIN && <div />}
                        {mobileIdCol && <div className="break-words leading-tight">{mobileIdCol.label}</div>}
                        {mobileBodyCols.map(c => (
                            <div key={c.key} className="break-words leading-tight">{c.label}</div>
                        ))}
                        <div className="text-right">Status</div>
                        {user.role === ROLES.ADMIN && <div />}
                    </div>
                </div>

                {/* ── Mobile card list (< md) ── */}
                <div className="md:hidden divide-y divide-slate-100">
                    {filteredSigns.map(sign => (
                        <SignCard
                            key={sign._id}
                            sign={sign}
                            columns={activeColumns}
                            gridTemplate={mobileGridTemplate}
                            user={user}
                            selected={selectedSigns.has(sign._id)}
                            onSelect={(id) => {
                                const newSet = new Set(selectedSigns);
                                if (newSet.has(id)) newSet.delete(id);
                                else newSet.add(id);
                                setSelectedSigns(newSet);
                            }}
                            onUploadRequest={handleUploadRequest}
                            onDirectUpload={(file, stage, isFactory) => executeUpload(sign, file, stage, isFactory)}
                            factoryStages={boq.factoryStages || []}
                            siteStages={boq.siteStages || []}
                            onToggleStage={handleToggleStage}
                            onDelete={async () => {
                                if (window.confirm('Delete sign?')) {
                                    try {
                                        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'signs', sign._id));
                                    } catch (err) {
                                        console.error(err);
                                        alert("Delete failed: " + err.message);
                                    }
                                }
                            }}
                            onEdit={() => setEditingSign(sign)}
                            onViewImage={(images, idx, field) => setLightboxImages({ images, index: idx, signId: sign._id, field })}
                        />
                    ))}
                    {filteredSigns.length === 0 && (
                        <div className="p-10 text-center text-slate-400 text-sm">No records match the current filters.</div>
                    )}
                </div>

                {/* ── Desktop table (≥ md) ── */}
                <table className="hidden md:table w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm text-xs font-bold text-slate-500 uppercase tracking-[0.08em] align-bottom">
                        <tr>
                            <th className="px-2 py-2 w-8 text-center border-b border-slate-200">
                                {user.role === ROLES.ADMIN && (
                                    <input
                                        type="checkbox"
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedSigns(new Set(filteredSigns.map(s => s._id)));
                                            else setSelectedSigns(new Set());
                                        }}
                                        checked={filteredSigns.length > 0 && selectedSigns.size === filteredSigns.length}
                                    />
                                )}
                            </th>
                            <th className="px-2 py-2 border-b border-slate-200 cursor-pointer hover:bg-slate-100 w-24" onClick={() => setSortConfig({ key: 'status', direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' })}>
                                <div className="flex items-center gap-1">Status {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                            </th>
                            {activeColumns.map(col => (
                                <th
                                    key={col.key}
                                    style={{ width: colWidths[col.key] }}
                                    className="px-2 py-2 border-b border-slate-200 cursor-pointer hover:bg-slate-100 whitespace-normal break-words leading-tight"
                                    onClick={() => setSortConfig({ key: col.key, direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' })}
                                >
                                    <div className="flex items-start gap-1">
                                        <span>{col.label}</span>
                                        {sortConfig?.key === col.key && (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="flex-shrink-0 mt-0.5" /> : <ChevronDown size={12} className="flex-shrink-0 mt-0.5" />)}
                                    </div>
                                </th>
                            ))}
                            <th className="px-2 py-2 border-b border-slate-200">Artwork</th>
                            {(boq.factoryStages || []).length > 0 && (
                                <th className="px-2 py-2 border-b border-slate-200 w-24 cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => setSortConfig({ key: '_factoryImageDate', direction: sortConfig?.key === '_factoryImageDate' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                                    title="Sort by latest factory photo date">
                                    <div className="flex items-center gap-1">
                                        Factory
                                        {sortConfig?.key === '_factoryImageDate' ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="text-slate-300" />}
                                    </div>
                                </th>
                            )}
                            {(boq.siteStages || []).length > 0 && (
                                <th className="px-2 py-2 border-b border-slate-200 w-24 cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => setSortConfig({ key: '_siteImageDate', direction: sortConfig?.key === '_siteImageDate' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                                    title="Sort by latest site photo date">
                                    <div className="flex items-center gap-1">
                                        Site
                                        {sortConfig?.key === '_siteImageDate' ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="text-slate-300" />}
                                    </div>
                                </th>
                            )}
                            {user.role === ROLES.ADMIN && <th className="px-2 py-2 border-b border-slate-200 text-center w-16">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                        {filteredSigns.map(sign => (
                            <SignRow
                                key={sign._id}
                                sign={sign}
                                columns={activeColumns}
                                colWidths={colWidths}
                                user={user}
                                selected={selectedSigns.has(sign._id)}
                                onSelect={(id) => {
                                    const newSet = new Set(selectedSigns);
                                    if (newSet.has(id)) newSet.delete(id);
                                    else newSet.add(id);
                                    setSelectedSigns(newSet);
                                }}
                                onUploadRequest={handleUploadRequest}
                                onDirectUpload={(file, stage, isFactory) => executeUpload(sign, file, stage, isFactory)}
                                factoryStages={boq.factoryStages || []}
                                siteStages={boq.siteStages || []}
                                onToggleStage={handleToggleStage}
                                onDelete={async () => {
                                    if (window.confirm('Delete sign?')) {
                                        try {
                                            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'signs', sign._id));
                                        } catch (err) {
                                            console.error(err);
                                            alert("Delete failed: " + err.message);
                                        }
                                    }
                                }}
                                onEdit={() => setEditingSign(sign)}
                                onViewImage={(images, idx, field) => setLightboxImages({ images, index: idx, signId: sign._id, field })}
                            />
                        ))}
                    </tbody>
                </table>
            </div>}

            {activeTab === 'dpr' && <DPRTab boq={boq} user={user} />}

            {importConfig && (
                <ImportMapper
                    config={importConfig}
                    onClose={() => setImportConfig(null)}
                    onConfirm={confirmImport}
                />
            )}
        </div>
    );
};

// ── QC UI helpers ─────────────────────────────────────────────────────────────

// ── Stage checklist chips ─────────────────────────────────────────────────────
// Abbreviate a stage label to 2–3 chars for the dense desktop table.
// Multi-word → initials ("Double Nut" → "DN"); single word → first two letters ("Board" → "Bo").
const abbrevStage = (s) => {
    const words = String(s).trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length > 1) return words.map(w => w[0]).join('').slice(0, 3).toUpperCase();
    const w = words[0];
    return (w[0].toUpperCase() + (w[1] || '')).slice(0, 2);
};

// Latest image timestamp (ISO string) from an images array, or '' if none.
const latestImageTs = (imgs) =>
    (imgs && imgs.length)
        ? imgs.reduce((latest, img) => (img.timestamp && img.timestamp > latest ? img.timestamp : latest), '')
        : '';

// Compact "6 Jun" date for the dense table (full date-time available on hover via title).
const fmtShortDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// Stage checklist chips. `compact` renders a single line of tiny abbreviated chips plus a
// done/total count — used in the dense desktop table where each row must stay short.
// Otherwise it renders the roomier full-label chips that wrap (used on mobile cards).
const StageDots = ({ stages, checks, onToggle, isFactory, compact = false }) => {
    if (!stages || stages.length === 0) return null;
    const doneCount = stages.filter(st => checks?.[st]?.checked).length;

    if (compact) {
        return (
            <div className="flex items-center gap-0.5 flex-nowrap">
                {stages.map(stage => {
                    const info = checks?.[stage];
                    const done = info?.checked;
                    return (
                        <button
                            key={stage}
                            onClick={onToggle ? (e) => { e.stopPropagation(); onToggle(stage); } : undefined}
                            title={done ? `✓ ${stage}${info.by ? ` — by ${info.by}` : ''}` : `${stage} — tap to mark done`}
                            className={`px-1 py-0.5 rounded text-[9px] font-bold leading-none tracking-tight transition-all select-none ${
                                done
                                    ? isFactory ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                    : 'bg-slate-100 text-slate-400'
                            } ${onToggle ? 'cursor-pointer hover:ring-1 hover:ring-slate-300 active:scale-95' : 'cursor-default'}`}
                        >
                            {abbrevStage(stage)}
                        </button>
                    );
                })}
                <span className="ml-0.5 text-[9px] font-semibold text-slate-400 tabular-nums whitespace-nowrap">{doneCount}/{stages.length}</span>
            </div>
        );
    }

    return (
        <div className="flex gap-1 flex-wrap mt-0.5">
            {stages.map(stage => {
                const info = checks?.[stage];
                const done = info?.checked;
                const label = stage.length > 11 ? stage.slice(0, 10) + '…' : stage;
                return (
                    <button
                        key={stage}
                        onClick={onToggle ? (e) => { e.stopPropagation(); onToggle(stage); } : undefined}
                        title={done ? `✓ ${stage}${info.by ? ` — by ${info.by}` : ''}` : `${stage} — tap to mark done`}
                        className={`flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-full border text-[9px] font-semibold transition-all select-none ${
                            done
                                ? isFactory
                                    ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                                    : 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400 hover:text-slate-600'
                        } ${onToggle ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            done ? isFactory ? 'bg-blue-500' : 'bg-green-500' : 'bg-slate-300'
                        }`} />
                        {label}
                    </button>
                );
            })}
        </div>
    );
};

const SignCard = ({ sign, columns, gridTemplate = '', user, selected, onSelect, onUploadRequest, onDirectUpload, onDelete, onEdit, onViewImage, factoryStages, siteStages, onToggleStage }) => {
    const isFactory = user.role === ROLES.FACTORY || user.role === ROLES.DUAL || user.role === ROLES.ADMIN;
    const isSite = user.role === ROLES.SITE || user.role === ROLES.DUAL || user.role === ROLES.ADMIN;

    const artImages = sign.artworkImages || (sign.artworkImage ? [{ url: sign.artworkImage }] : []);
    const factImages = sign.factoryImages || [];
    const siteImages = sign.siteImages || [];

    // Latest photo timestamps (mirrors the desktop table)
    const factoryTs = latestImageTs(factImages);
    const siteTs = latestImageTs(siteImages);

    const statusColor = (s) => {
        if (s.includes('Ready')) return 'bg-blue-100 text-blue-700';
        if (s.includes('Approval')) return 'bg-orange-100 text-orange-700';
        if (s.includes('Completed')) return 'bg-green-100 text-green-700';
        return 'bg-slate-100 text-slate-600';
    };

    // ID column and a subset of visible columns for the card body
    const idCol = columns.find(c => c.isId);
    const bodyColumns = columns.filter(c => !c.isId && c.visible).slice(0, 6);

    return (
        <div className={`px-3 py-2 transition-colors active:bg-slate-50 ${selected ? 'bg-indigo-50/60' : 'bg-white'}`}>
            {/* Aligned data grid — same columns as the fixed mobile header */}
            <div className="grid gap-x-2 gap-y-0.5 items-start" style={{ gridTemplateColumns: gridTemplate }}>
                {user.role === ROLES.ADMIN && (
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onSelect(sign._id)}
                        className="w-4 h-4 mt-0.5 accent-indigo-600"
                    />
                )}
                {idCol && (
                    <span className="text-xs font-bold text-slate-800 break-words leading-tight">
                        {sign[idCol.key]}
                    </span>
                )}
                {bodyColumns.map(col => (
                    <span key={col.key} className="text-[10px] text-slate-700 break-words leading-tight">
                        {sign[col.key]}
                    </span>
                ))}
                {/* Status */}
                <div className="flex flex-col items-end gap-0.5 min-w-0">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide text-right break-words leading-tight ${statusColor(sign.status)}`}>
                        {sign.status}
                    </span>
                </div>
                {/* Actions */}
                {user.role === ROLES.ADMIN && (
                    <div className="flex items-start justify-end">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            className="p-1 rounded text-slate-400 active:bg-blue-50 active:text-blue-600"
                        >
                            <Edit size={13} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                            className="p-1 rounded text-slate-300 active:bg-red-50 active:text-red-500"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                )}
            </div>

            {/* Images — full width, the 3 sections (Art / Fab / Site) spread evenly */}
            <div className="flex items-start gap-2 mt-2">
                {/* Artwork */}
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wide flex-shrink-0">Art</span>
                    <div className="flex flex-wrap gap-0.5">
                        {artImages.length > 0 ? artImages.map((img, idx) => (
                            <div
                                key={idx}
                                onClick={() => onViewImage(artImages, idx, 'artworkImages')}
                                className="w-8 h-8 bg-white rounded border shadow-sm flex-shrink-0 cursor-zoom-in"
                            >
                                <img src={img.thumbUrl || img.url} alt="" loading="lazy" className="w-full h-full object-contain rounded" />
                            </div>
                        )) : (
                            <div className="w-8 h-8 bg-slate-50 rounded border border-dashed flex items-center justify-center text-slate-300">
                                <ImageIcon size={12} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Factory photos */}
                {(factImages.length > 0 || isFactory) && (
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wide flex-shrink-0">Fab</span>
                        <div className="flex flex-wrap gap-0.5">
                            {factImages.length > 0 ? factImages.map((img, idx) => (
                                <div key={idx} onClick={() => onViewImage(factImages, idx, 'factoryImages')}
                                    className="relative w-8 h-8 bg-white rounded border shadow-sm flex-shrink-0 cursor-zoom-in">
                                    <img src={img.thumbUrl || img.url} alt="" loading="lazy" className="w-full h-full object-cover rounded" />
                                </div>
                            )) : <div className="w-8 h-8 bg-slate-50 rounded border border-dashed flex items-center justify-center text-slate-300"><Package size={12} /></div>}
                            {isFactory && (
                                <button onClick={() => onUploadRequest(sign, true)}
                                    className="w-8 h-8 flex items-center justify-center bg-white border rounded-full text-blue-400 active:bg-blue-50 shadow-sm flex-shrink-0"
                                    title="Add photo">
                                    <Camera size={11} />
                                    <input id={`file-fact-${sign._id}`} type="file" className="hidden" accept="image/*" capture="environment"
                                        onChange={(e) => onDirectUpload(e.target.files[0], 'General Production', true)} />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Site photos */}
                {(siteImages.length > 0 || isSite) && (
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wide flex-shrink-0">Site</span>
                        <div className="flex flex-wrap gap-0.5">
                            {siteImages.length > 0 ? siteImages.map((img, idx) => (
                                <div key={idx} onClick={() => onViewImage(siteImages, idx, 'siteImages')}
                                    className="relative w-8 h-8 bg-white rounded border shadow-sm flex-shrink-0 cursor-zoom-in"
                                    title={img.remarks || undefined}>
                                    <img src={img.thumbUrl || img.url} alt="" loading="lazy" className="w-full h-full object-cover rounded" />
                                    {img.remarks && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-white" />}
                                </div>
                            )) : <div className="w-8 h-8 bg-slate-50 rounded border border-dashed flex items-center justify-center text-slate-300"><Truck size={12} /></div>}
                            {isSite && (
                                <button onClick={() => onUploadRequest(sign, false)}
                                    className="w-8 h-8 flex items-center justify-center bg-white border rounded-full text-green-400 active:bg-green-50 shadow-sm flex-shrink-0"
                                    title="Add photo">
                                    <Camera size={11} />
                                    <input id={`file-site-${sign._id}`} type="file" className="hidden" accept="image/*" capture="environment"
                                        onChange={(e) => onDirectUpload(e.target.files[0], 'Installation', false)} />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Stage checklists + photo dates — full width */}
            {(factoryStages.length > 0 || siteStages.length > 0) && (
                <div className="mt-1.5 space-y-1">
                    {factoryStages.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wide w-7 flex-shrink-0">Fab</span>
                            {factoryTs && (
                                <span title={`Latest factory photo: ${new Date(factoryTs).toLocaleString()}`}
                                    className="flex items-center gap-0.5 text-[9px] text-slate-400 tabular-nums whitespace-nowrap flex-shrink-0">
                                    <Clock size={9} /> {fmtShortDate(factoryTs)}
                                </span>
                            )}
                            <StageDots stages={factoryStages} checks={sign.factoryStageChecks} isFactory={true} compact
                                onToggle={isFactory ? (stage) => onToggleStage(sign, stage, true) : null} />
                        </div>
                    )}
                    {siteStages.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wide w-7 flex-shrink-0">Site</span>
                            {siteTs && (
                                <span title={`Latest site photo: ${new Date(siteTs).toLocaleString()}`}
                                    className="flex items-center gap-0.5 text-[9px] text-slate-400 tabular-nums whitespace-nowrap flex-shrink-0">
                                    <Clock size={9} /> {fmtShortDate(siteTs)}
                                </span>
                            )}
                            <StageDots stages={siteStages} checks={sign.siteStageChecks} isFactory={false} compact
                                onToggle={isSite ? (stage) => onToggleStage(sign, stage, false) : null} />
                        </div>
                    )}
                </div>
            )}

            {/* Site remarks */}
            {siteImages.some(img => img.remarks) && (
                <div className="mt-1 space-y-0.5 pl-[34px]">
                    {siteImages.map((img, idx) => img.remarks ? (
                        <p key={idx} className="text-[9px] text-slate-500 italic leading-tight">
                            <span className="font-semibold not-italic text-slate-400">#{idx + 1}</span> {img.remarks}
                        </p>
                    ) : null)}
                </div>
            )}

        </div>
    );
};

// ── Desktop table row ─────────────────────────────────────────────────────────
const SignRow = ({ sign, columns, colWidths = {}, user, selected, onSelect, onUploadRequest, onDirectUpload, onDelete, onEdit, onViewImage, factoryStages, siteStages, onToggleStage }) => {
    const isFactory = user.role === ROLES.FACTORY || user.role === ROLES.DUAL || user.role === ROLES.ADMIN;
    const isSite = user.role === ROLES.SITE || user.role === ROLES.DUAL || user.role === ROLES.ADMIN;

    // Normalize images arrays
    const artImages = sign.artworkImages || (sign.artworkImage ? [{ url: sign.artworkImage }] : []);
    const factImages = sign.factoryImages || [];
    const siteImages = sign.siteImages || [];

    // Latest photo timestamps surfaced compactly in the Factory/Site cells
    const factoryTs = latestImageTs(factImages);
    const siteTs = latestImageTs(siteImages);

    const statusColor = (s) => {
        if (s.includes('Ready')) return 'bg-blue-100 text-blue-700';
        if (s.includes('Approval')) return 'bg-orange-100 text-orange-700';
        if (s.includes('Completed')) return 'bg-green-100 text-green-700';
        return 'bg-slate-100 text-slate-600';
    };

    return (
        <tr className={`hover:bg-slate-50 transition text-xs group ${selected ? 'bg-indigo-50/50' : ''}`}>
            <td className="px-2 py-1.5 text-center align-middle">
                {user.role === ROLES.ADMIN && (
                    <input type="checkbox" checked={selected} onChange={() => onSelect(sign._id)} />
                )}
            </td>
            <td className="px-2 py-1.5 align-middle">
                <span className={`px-1.5 py-0.5 rounded-sm font-semibold tracking-wide ${statusColor(sign.status)}`}>
                    {sign.status}
                </span>
            </td>
            {columns.filter(c => c.visible).map(col => (
                <td key={col.key}
                    style={{ width: colWidths[col.key], maxWidth: colWidths[col.key] }}
                    title={sign[col.key] != null ? String(sign[col.key]) : undefined}
                    className="px-2 py-1.5 text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis align-middle">
                    {sign[col.key]}
                </td>
            ))}
            <td className="px-2 py-1.5 align-middle">
                <div className="flex -space-x-1 overflow-hidden hover:space-x-1 transition-all">
                    {artImages.length > 0 ? artImages.map((img, idx) => (
                        <div
                            key={idx}
                            onClick={() => onViewImage(artImages, idx, 'artworkImages')}
                            className="w-7 h-7 bg-white rounded border shadow-sm flex-shrink-0 cursor-zoom-in relative hover:z-10 hover:scale-110 transition"
                        >
                            <img src={img.thumbUrl || img.url} alt="" loading="lazy" className="w-full h-full object-contain rounded" />
                        </div>
                    )) : <div className="w-7 h-7 bg-slate-100 rounded border flex items-center justify-center text-slate-300"><ImageIcon size={12} /></div>}
                </div>
            </td>

            {/* Factory Column — only when factory stages are configured */}
            {factoryStages.length > 0 && (
            <td className="px-2 py-1.5 align-middle">
                <div className="flex items-center gap-1">
                    <div className="flex -space-x-1 hover:space-x-1 transition-all">
                        {factImages.length > 0 ? factImages.map((img, idx) => (
                            <div key={idx} onClick={() => onViewImage(factImages, idx, 'factoryImages')}
                                className="w-7 h-7 bg-white rounded border shadow-sm flex-shrink-0 cursor-zoom-in relative hover:z-10 hover:scale-110 transition">
                                <img src={img.thumbUrl || img.url} alt="" loading="lazy" className="w-full h-full object-cover rounded" />
                            </div>
                        )) : <div className="w-7 h-7 bg-slate-50 rounded border border-dashed flex items-center justify-center text-slate-300"><Package size={12} /></div>}
                    </div>
                    {isFactory && (
                        <button onClick={() => onUploadRequest(sign, true)}
                            className="cursor-pointer w-5 h-5 flex items-center justify-center hover:bg-blue-100 text-blue-500 rounded-full transition border bg-white flex-shrink-0"
                            title="Add photo">
                            <Camera size={10} />
                            <input id={`file-fact-${sign._id}`} type="file" className="hidden" accept="image/*" capture="environment"
                                onChange={(e) => onDirectUpload(e.target.files[0], 'General Production', true)} />
                        </button>
                    )}
                    {factoryTs && (
                        <span title={`Latest factory photo: ${new Date(factoryTs).toLocaleString()}`}
                            className="flex items-center gap-0.5 text-[9px] text-slate-400 tabular-nums whitespace-nowrap flex-shrink-0">
                            <Clock size={9} /> {fmtShortDate(factoryTs)}
                        </span>
                    )}
                    <StageDots stages={factoryStages} checks={sign.factoryStageChecks} isFactory={true} compact
                        onToggle={isFactory ? (stage) => onToggleStage(sign, stage, true) : null} />
                </div>
            </td>
            )}

            {/* Site Column — only when site stages are configured */}
            {siteStages.length > 0 && (
            <td className="px-2 py-1.5 align-top">
                <div className="flex items-center gap-1">
                    <div className="flex -space-x-1 hover:space-x-1 transition-all">
                        {siteImages.length > 0 ? siteImages.map((img, idx) => (
                            <div key={idx} onClick={() => onViewImage(siteImages, idx, 'siteImages')}
                                className="w-7 h-7 bg-white rounded border shadow-sm flex-shrink-0 cursor-zoom-in relative hover:z-10 hover:scale-110 transition"
                                title={img.remarks || undefined}>
                                <img src={img.thumbUrl || img.url} alt="" loading="lazy" className="w-full h-full object-cover rounded" />
                                {img.remarks && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-white" />}
                            </div>
                        )) : <div className="w-7 h-7 bg-slate-50 rounded border border-dashed flex items-center justify-center text-slate-300"><Truck size={12} /></div>}
                    </div>
                    {isSite && (
                        <button onClick={() => onUploadRequest(sign, false)}
                            className="cursor-pointer w-5 h-5 flex items-center justify-center hover:bg-green-100 text-green-500 rounded-full transition border bg-white flex-shrink-0"
                            title="Add photo">
                            <Camera size={10} />
                            <input id={`file-site-${sign._id}`} type="file" className="hidden" accept="image/*" capture="environment"
                                onChange={(e) => onDirectUpload(e.target.files[0], 'Installation', false)} />
                        </button>
                    )}
                    {siteTs && (
                        <span title={`Latest site photo: ${new Date(siteTs).toLocaleString()}`}
                            className="flex items-center gap-0.5 text-[9px] text-slate-400 tabular-nums whitespace-nowrap flex-shrink-0">
                            <Clock size={9} /> {fmtShortDate(siteTs)}
                        </span>
                    )}
                    <StageDots stages={siteStages} checks={sign.siteStageChecks} isFactory={false} compact
                        onToggle={isSite ? (stage) => onToggleStage(sign, stage, false) : null} />
                </div>
                {siteImages.some(img => img.remarks) && (
                    <div className="mt-1 space-y-0.5 max-w-[180px]">
                        {siteImages.map((img, idx) => img.remarks ? (
                            <p key={idx} className="text-[10px] text-slate-500 italic leading-tight">
                                <span className="font-semibold not-italic text-slate-400">#{idx + 1}</span> {img.remarks}
                            </p>
                        ) : null)}
                    </div>
                )}
            </td>
            )}

            {/* Actions Column */}
            {user.role === ROLES.ADMIN && (
                <td className="px-2 py-1.5 text-center align-middle">
                    <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit();
                            }}
                            className="p-1 hover:bg-blue-50 text-blue-400 hover:text-blue-600 rounded transition"
                            title="Edit Sign"
                        >
                            <Edit size={13} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="p-1 hover:bg-red-50 text-red-400 hover:text-red-600 rounded transition"
                            title="Delete Sign"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                </td>
            )}
        </tr>
    );
};

const ImportMapper = ({ config, onClose, onConfirm }) => {
    const [uniqueId, setUniqueId] = useState(config.headers[0]);
    const [displayCols, setDisplayCols] = useState(new Set(config.headers.slice(0, 5)));
    const [filterCols, setFilterCols] = useState(new Set(config.headers.slice(1, 3)));

    const toggleSet = (set, setter, val) => {
        const newSet = new Set(set);
        if (newSet.has(val)) newSet.delete(val);
        else newSet.add(val);
        setter(newSet);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b">
                    <h3 className="text-xl font-bold">Import Configuration</h3>
                    <p className="text-sm text-slate-500">Found {config.data.length} valid rows. Map your columns below.</p>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    <div className="bg-amber-50 p-4 rounded text-sm text-amber-800 border border-amber-200">
                        <strong>Preview first row:</strong>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs overflow-auto max-h-32">
                            {Object.entries(config.data[0] || {}).filter(([k]) => !k.endsWith('_isImage')).map(([k, v]) => (
                                <div key={k} className="truncate" title={String(v)}>
                                    <span className="font-bold">{k}:</span> {config.data[0][k + '_isImage'] ? <span className="text-indigo-600 font-bold">[IMAGE]</span> : String(v)}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Unique Identifier (Sign No)</label>
                        <select
                            className="w-full border p-2 rounded"
                            value={uniqueId}
                            onChange={(e) => setUniqueId(e.target.value)}
                        >
                            {config.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Display Columns</label>
                            <div className="space-y-1 max-h-60 overflow-y-auto border p-2 rounded">
                                {config.headers.map(h => (
                                    <label key={`d-${h}`} className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={displayCols.has(h)} onChange={() => toggleSet(displayCols, setDisplayCols, h)} />
                                        {h}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Enable Filtering</label>
                            <div className="space-y-1 max-h-60 overflow-y-auto border p-2 rounded">
                                {config.headers.map(h => (
                                    <label key={`f-${h}`} className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={filterCols.has(h)} onChange={() => toggleSet(filterCols, setFilterCols, h)} />
                                        {h}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t bg-slate-50 rounded-b-xl flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium">Cancel</button>
                    <button
                        onClick={() => onConfirm(uniqueId, Array.from(displayCols), Array.from(filterCols))}
                        className="px-6 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700"
                    >
                        Import Data
                    </button>
                </div>
            </div>
        </div>
    );
};

const PrintView = ({ boq, signs, columns, onClose }) => {
    const [showColMenu, setShowColMenu] = useState(false);
    const [printing, setPrinting] = useState(false);
    const [selectedColIds, setSelectedColIds] = useState(() => {
        const initial = new Set(['art']);
        if ((boq.factoryStages || []).length > 0) initial.add('fact_all');
        if ((boq.siteStages || []).length > 0) initial.add('site_all');
        return initial;
    });

    // Remote (Storage-hosted) images load asynchronously, so wait for them
    // before opening the print dialog — otherwise the printout shows blanks.
    // Inline base64 images need no preloading; a 15s cap stops a dead URL
    // from blocking the print forever.
    const handlePrint = async () => {
        if (printing) return;
        setPrinting(true);
        try {
            const urls = [];
            signs.forEach(s => {
                ['artworkImages', 'factoryImages', 'siteImages'].forEach(f => {
                    (s[f] || []).forEach(img => {
                        const u = img?.url || img;
                        if (typeof u === 'string' && !u.startsWith('data:')) urls.push(u);
                    });
                });
            });
            const loadAll = Promise.all(urls.map(u => new Promise(res => {
                const im = new Image();
                im.onload = res;
                im.onerror = res;
                im.src = u;
            })));
            await Promise.race([loadAll, new Promise(res => setTimeout(res, 15000))]);
        } finally {
            setPrinting(false);
        }
        window.print();
    };

    // Construct available report options dynamically — factory/site only appear when stages are configured
    const reportOptions = useMemo(() => {
        const opts = [
            { id: 'art', label: 'Artwork', type: 'artwork', color: 'text-indigo-600' },
        ];

        if (boq.factoryStages && boq.factoryStages.length > 0) {
            opts.push({ id: 'fact_all', label: 'Factory (All)', type: 'factory', mode: 'all', color: 'text-orange-600' });
            boq.factoryStages.forEach(s => {
                opts.push({ id: `fact_${s}`, label: `Factory - ${s}`, type: 'factory', mode: 'stage', stage: s, color: 'text-orange-500' });
            });
        }

        if (boq.siteStages && boq.siteStages.length > 0) {
            opts.push({ id: 'site_all', label: 'Site (All)', type: 'site', mode: 'all', color: 'text-green-600' });
            boq.siteStages.forEach(s => {
                opts.push({ id: `site_${s}`, label: `Site - ${s}`, type: 'site', mode: 'stage', stage: s, color: 'text-green-500' });
            });
        }

        return opts;
    }, [boq]);

    const toggleCol = (id) => {
        const next = new Set(selectedColIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedColIds(next);
    };

    const activeReportCols = reportOptions.filter(o => selectedColIds.has(o.id));
    const textCols = columns.filter(c => !c.isId).slice(0, 5);
    const idCol = columns.find(c => c.isId);

    const getImagesForCol = (sign, colConfig) => {
        if (colConfig.type === 'artwork') return sign.artworkImages || (sign.artworkImage ? [{ url: sign.artworkImage }] : []);

        const source = colConfig.type === 'factory' ? (sign.factoryImages || []) : (sign.siteImages || []);

        if (colConfig.mode === 'all') return source;
        return source.filter(img => img.stages ? img.stages.includes(colConfig.stage) : img.stage === colConfig.stage);
    };

    // ── Column resize ──────────────────────────────────────────────────────────
    const tableRef = useRef(null);

    const defaultWidths = () => {
        const imgCount = activeReportCols.length || 1;
        const w = { __details__: 28 };
        activeReportCols.forEach(c => { w[c.id] = 72 / imgCount; });
        return w;
    };
    const [colWidths, setColWidths] = useState(defaultWidths);

    // Reset when the set of visible columns changes
    useEffect(() => { setColWidths(defaultWidths()); }, [selectedColIds]);

    const startResize = (e, colIdx) => {
        e.preventDefault();
        const startX = e.clientX;
        const allIds = ['__details__', ...activeReportCols.map(c => c.id)];
        const snapshot = { ...colWidths };
        const tableWidth = tableRef.current?.offsetWidth || 800;

        const onMove = (mv) => {
            const delta = ((mv.clientX - startX) / tableWidth) * 100;
            const aId = allIds[colIdx];
            const bId = allIds[colIdx + 1];
            if (!bId) return;
            const newA = Math.max(5, snapshot[aId] + delta);
            const newB = Math.max(5, snapshot[bId] - delta);
            if (newA >= 5 && newB >= 5)
                setColWidths(prev => ({ ...prev, [aId]: newA, [bId]: newB }));
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    // ── A4 page sizing ─────────────────────────────────────────────────────────
    const [orientation, setOrientation] = useState('landscape');
    const previewRef = useRef(null);
    const [scale, setScale] = useState(1);

    const CM = 37.795; // px per cm at 96 dpi
    const PAGE_W_PX = (orientation === 'landscape' ? 29.7 : 21) * CM;
    const PAGE_H_PX = (orientation === 'landscape' ? 21 : 29.7) * CM;

    useEffect(() => {
        const pageW = (orientation === 'landscape' ? 29.7 : 21) * CM;
        const compute = () => {
            if (!previewRef.current) return;
            const avail = previewRef.current.offsetWidth - 48;
            setScale(Math.min(1, avail / pageW));
        };
        compute();
        const ro = new ResizeObserver(compute);
        if (previewRef.current) ro.observe(previewRef.current);
        return () => ro.disconnect();
    }, [orientation]);

    return (
        <div className="min-h-screen flex flex-col bg-slate-600">
            {/* ── Toolbar ── */}
            <div className="fixed top-0 left-0 right-0 bg-slate-800 text-white py-2 px-4 flex items-center justify-between print:hidden shadow-lg z-50 gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="hover:bg-slate-700 p-1.5 rounded">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="font-bold text-sm">Report Preview</span>
                </div>
                <div className="flex items-center gap-3 text-sm relative">
                    {/* Orientation toggle */}
                    <div className="flex bg-slate-700 rounded p-0.5 gap-0.5">
                        {['portrait', 'landscape'].map(o => (
                            <button
                                key={o}
                                onClick={() => setOrientation(o)}
                                className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors ${
                                    orientation === o ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                {o}
                            </button>
                        ))}
                    </div>

                    {/* Column selector */}
                    <button
                        onClick={() => setShowColMenu(!showColMenu)}
                        className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded"
                    >
                        <List size={14} /> Columns
                    </button>
                    {showColMenu && (
                        <div className="absolute top-full right-16 mt-2 bg-white text-slate-800 rounded-xl shadow-xl border w-64 p-2 max-h-[80vh] overflow-y-auto z-50">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 px-2">Select Image Columns</h4>
                            {reportOptions.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => toggleCol(opt.id)}
                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded flex items-center gap-2 text-sm"
                                >
                                    {selectedColIds.has(opt.id)
                                        ? <CheckSquare size={16} className="text-indigo-600" />
                                        : <div className="w-4 h-4 border rounded border-slate-300" />}
                                    <span className={opt.color}>{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <button onClick={handlePrint} disabled={printing} className="bg-white text-slate-900 px-4 py-1 rounded font-bold flex items-center gap-2 disabled:opacity-60">
                        <Printer size={14} /> {printing ? 'Preparing…' : 'Print'}
                    </button>
                </div>
            </div>

            {/* ── A4 page preview ── */}
            <div ref={previewRef} className="mt-12 flex-1 flex flex-col items-center py-8 px-6 print:hidden overflow-auto">
                {/* Outer shell at scaled dimensions so the page takes up correct space in the flow */}
                <div style={{ width: PAGE_W_PX * scale, minHeight: PAGE_H_PX * scale, position: 'relative', flexShrink: 0 }}>
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: PAGE_W_PX,
                            minHeight: PAGE_H_PX,
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left',
                            padding: '1cm',
                            boxSizing: 'border-box',
                            backgroundColor: 'white',
                            boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
                        }}
                    >
                        {renderReportTable(true)}
                    </div>
                </div>
            </div>

            {/* ── Print portal ── */}
            {ReactDOM.createPortal(
                <div className="print-only-portal">
                    {renderReportTable(false)}
                </div>,
                document.body
            )}

            <style>{`
                @media print {
                    @page { size: A4 ${orientation}; margin: 1cm; }
                    body { -webkit-print-color-adjust: exact; }
                }
            `}</style>
        </div>
    );

    function renderReportTable(forScreen = false) {
        const allIds = ['__details__', ...activeReportCols.map(c => c.id)];
        return (
            <div className="text-xs text-black">
                <div className="mb-3 border-b pb-2 flex justify-between items-end">
                    <h1 className="text-xl font-bold uppercase">{boq.name}</h1>
                    <p className="text-xs text-slate-500">Generated {new Date().toLocaleDateString()}</p>
                </div>

                <table
                    ref={forScreen ? tableRef : undefined}
                    className="w-full text-xs border-collapse border border-slate-300 table-fixed"
                >
                    <colgroup>
                        <col style={{ width: `${colWidths['__details__'] ?? 28}%` }} />
                        {activeReportCols.map(col => (
                            <col key={col.id} style={{ width: `${colWidths[col.id] ?? (72 / activeReportCols.length)}%` }} />
                        ))}
                    </colgroup>
                    <thead>
                        <tr className="bg-slate-100">
                            {allIds.map((id, idx) => {
                                const col = activeReportCols.find(c => c.id === id);
                                const isLast = idx === allIds.length - 1;
                                return (
                                    <th
                                        key={id}
                                        className={`border border-slate-300 p-1.5 text-left relative select-none ${col ? `uppercase ${col.color}` : ''}`}
                                    >
                                        {col ? col.label : 'Sign Details'}
                                        {forScreen && !isLast && (
                                            <span
                                                onMouseDown={(e) => startResize(e, idx)}
                                                className="print:hidden absolute top-0 right-0 h-full w-2 cursor-col-resize flex items-center justify-center group"
                                                title="Drag to resize"
                                            >
                                                <span className="w-px h-4/5 bg-slate-300 group-hover:bg-indigo-400 group-active:bg-indigo-600 transition-colors rounded" />
                                            </span>
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {signs.map(sign => (
                            <tr key={sign._id} className="break-inside-avoid">
                                <td className="border border-slate-300 p-1 align-top">
                                    <div className="flex items-start">
                                        <span className="font-bold text-sm leading-none">{sign[idCol?.key] || sign._id}</span>
                                    </div>
                                    <div className="mt-0.5 leading-[1.1]">
                                        {textCols.map(c => (
                                            <div key={c.key} className="flex gap-x-1 text-xs">
                                                <span className="text-slate-500 font-medium whitespace-nowrap flex-shrink-0">{c.label}:</span>
                                                <span className="font-semibold break-words min-w-0">{sign[c.key]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </td>

                                {activeReportCols.map(col => {
                                    const images = getImagesForCol(sign, col);
                                    const bgClass = col.type === 'artwork' ? 'bg-slate-50/30' : (col.type === 'factory' ? 'bg-orange-50/10' : 'bg-green-50/10');

                                    // Determine which stages to show as a checklist
                                    let stageChecklist = null;
                                    if (col.type === 'factory' || col.type === 'site') {
                                        const allStages = col.type === 'factory' ? (boq.factoryStages || []) : (boq.siteStages || []);
                                        const checks = col.type === 'factory' ? (sign.factoryStageChecks || {}) : (sign.siteStageChecks || {});
                                        const stagesToShow = col.mode === 'all' ? allStages : (col.stage ? [col.stage] : []);
                                        const tickColor = col.type === 'factory' ? 'text-orange-600' : 'text-green-600';
                                        if (stagesToShow.length > 0) {
                                            stageChecklist = (
                                                <div className="mb-1 space-y-0.5">
                                                    {stagesToShow.map(stage => {
                                                        const done = checks[stage]?.checked;
                                                        return (
                                                            <div key={stage} className="flex items-center gap-1 text-[10px] leading-tight">
                                                                <span className={`flex-shrink-0 font-bold ${done ? tickColor : 'text-slate-300'}`}>
                                                                    {done ? '✓' : '○'}
                                                                </span>
                                                                <span className={done ? 'font-semibold text-slate-800' : 'text-slate-400'}>{stage}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        }
                                    }

                                    return (
                                        <td key={col.id} className={`border border-slate-300 p-1 align-top ${bgClass}`}>
                                            {stageChecklist}
                                            <div className="flex flex-wrap gap-1">
                                                {images.map((img, i) => (
                                                    <img key={i} src={img.url} className="h-16 w-auto object-contain border bg-white shadow-sm" alt="" />
                                                ))}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>

            </div>
        );
    }
};

const UserManagement = ({ onClose }) => {
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: ROLES.FACTORY });

    useEffect(() => {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
        const unsub = onSnapshot(q, sn => setUsers(sn.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsub();
    }, []);

    const handleCreate = async () => {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'users'), {
            ...newUser,
            createdAt: serverTimestamp()
        });
        setNewUser({ username: '', password: '', role: ROLES.FACTORY });
        alert("User record added.");
    };

    return (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
            <div className="max-w-3xl mx-auto p-4 md:p-8">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold">User Management</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X /></button>
                </div>

                <div className="bg-slate-50 p-6 rounded-xl mb-8">
                    <h3 className="font-bold mb-4">Create New User</h3>
                    <div className="flex flex-col md:flex-row gap-4">
                        <input
                            placeholder="Username"
                            className="flex-1 p-2 border rounded"
                            value={newUser.username}
                            onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                        />
                        <input
                            placeholder="Password"
                            type="text"
                            className="flex-1 p-2 border rounded"
                            value={newUser.password}
                            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                        />
                        <select
                            className="p-2 border rounded"
                            value={newUser.role}
                            onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                        >
                            <option value={ROLES.FACTORY}>Factory</option>
                            <option value={ROLES.SITE}>Site</option>
                            <option value={ROLES.DUAL}>Dual</option>
                            <option value={ROLES.ADMIN}>Admin</option>
                        </select>
                        <button onClick={handleCreate} className="bg-indigo-600 text-white px-4 py-2 rounded font-medium">Create</button>
                    </div>
                </div>

                <div className="space-y-2">
                    {users.map(u => (
                        <div key={u.id} className="flex justify-between items-center p-4 bg-white border rounded shadow-sm">
                            <div className="flex flex-col">
                                <span className="font-medium">{u.username}</span>
                                <span className="text-xs text-slate-500 uppercase">{u.role}</span>
                            </div>
                            <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.id))} className="text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ── DPR Tab ───────────────────────────────────────────────────────────────────

const DPRTab = ({ boq, user }) => {
    const canManageTasks = user.role === ROLES.ADMIN;
    const todayStr = () => new Date().toISOString().split('T')[0];

    const [tasks, setTasks] = useState([]);
    const [entries, setEntries] = useState([]);
    const [employees, setEmployees] = useState([]);

    // Task library form (admin only)
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [taskForm, setTaskForm] = useState({ name: '', description: '', unit: 'pcs', defaultDailyTarget: '', totalTarget: '' });
    const [savingTask, setSavingTask] = useState(false);

    // Log progress — per-task row state + shared date
    const [logDate, setLogDate] = useState(todayStr());
    const [logRows, setLogRows] = useState({});
    const [savingRow, setSavingRow] = useState(null);

    // Accordion
    const [expandedTasks, setExpandedTasks] = useState(new Set());

    useEffect(() => {
        const ref = collection(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'dpr_tasks');
        return onSnapshot(ref, snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name))));
    }, [boq.id]);

    useEffect(() => {
        const ref = collection(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'dpr_entries');
        return onSnapshot(ref, snap => {
            const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            loaded.sort((a, b) => b.date.localeCompare(a.date));
            setEntries(loaded);
        });
    }, [boq.id]);

    useEffect(() => {
        getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'payroll_employees'))
            .then(snap => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
            .catch(() => {});
    }, []);

    // Initialise a blank row for each task
    useEffect(() => {
        setLogRows(prev => {
            const next = {};
            tasks.forEach(t => { next[t.id] = prev[t.id] || { workers: [], actual: 0, workerSearch: '', showDrop: false }; });
            return next;
        });
    }, [tasks]);

    const cumulativeSummary = useMemo(() => {
        const map = {};
        entries.forEach(e => {
            if (!map[e.taskId]) map[e.taskId] = { taskName: e.taskName, unit: e.unit || 'pcs', total: 0, days: 0, totalTarget: 0 };
            map[e.taskId].total += e.actualCount || 0;
            map[e.taskId].days += 1;
        });
        tasks.forEach(t => { if (map[t.id]) map[t.id].totalTarget = t.totalTarget || 0; });
        return Object.values(map);
    }, [entries, tasks]);

    const handleSaveTask = async () => {
        if (!taskForm.name.trim()) return;
        const daily = Number(taskForm.defaultDailyTarget) || 0;
        const total = Number(taskForm.totalTarget) || 0;
        if (!daily && !total) { alert('Set at least a Daily Target or a Total Target.'); return; }
        setSavingTask(true);
        try {
            const data = { name: taskForm.name.trim(), description: taskForm.description.trim(), unit: taskForm.unit || 'pcs', defaultDailyTarget: daily, totalTarget: total };
            if (editingTask) {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'dpr_tasks', editingTask.id), data);
            } else {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'dpr_tasks'), data);
            }
            setShowTaskForm(false); setEditingTask(null);
            setTaskForm({ name: '', description: '', unit: 'pcs', defaultDailyTarget: '', totalTarget: '' });
        } catch (e) { alert('Error: ' + e.message); }
        setSavingTask(false);
    };

    const handleLogRow = async (taskId) => {
        const task = tasks.find(t => t.id === taskId);
        const row = logRows[taskId];
        if (!task || !logDate) return;
        setSavingRow(taskId);
        try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'dpr_entries'), {
                date: logDate,
                taskId,
                taskName: task.name,
                unit: task.unit || 'pcs',
                workers: row?.workers || [],
                actualCount: Number(row?.actual) || 0,
                targetCount: task.defaultDailyTarget || 0,
                createdBy: user.username,
                createdAt: serverTimestamp(),
            });
            setLogRows(prev => ({ ...prev, [taskId]: { workers: [], actual: 0, workerSearch: '', showDrop: false } }));
        } catch (e) { alert('Error: ' + e.message); }
        setSavingRow(null);
    };

    const updRow = (taskId, patch) => setLogRows(prev => ({ ...prev, [taskId]: { ...prev[taskId], ...patch } }));

    const fmtTs = (ts) => {
        if (!ts) return '—';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const day = String(d.getDate()).padStart(2, '0');
        const mon = MONTHS[d.getMonth()];
        let h = d.getHours();
        const ampm = h >= 12 ? 'pm' : 'am';
        h = h % 12 || 12;
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${day}-${mon} ${h}:${min}${ampm}`;
    };

    const toggleExpand = (taskId) => setExpandedTasks(prev => {
        const next = new Set(prev);
        next.has(taskId) ? next.delete(taskId) : next.add(taskId);
        return next;
    });

    // Per-task cumulative totals from entries
    const taskTotals = useMemo(() => {
        const map = {};
        entries.forEach(e => {
            if (!map[e.taskId]) map[e.taskId] = { total: 0, days: 0 };
            map[e.taskId].total += e.actualCount || 0;
            map[e.taskId].days += 1;
        });
        return map;
    }, [entries]);

    // Entries grouped by task (sorted date desc already from snapshot)
    const entriesByTask = useMemo(() => {
        const map = {};
        entries.forEach(e => { (map[e.taskId] = map[e.taskId] || []).push(e); });
        return map;
    }, [entries]);

    const colCount = canManageTasks ? 7 : 6;
    const th = 'px-2 py-1.5 text-left text-sm font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap';
    const td = 'px-2 py-2 align-top text-sm';

    return (
        <div className="flex-1 overflow-auto bg-slate-50 p-3">
            <div className="bg-white rounded-xl border border-slate-200" style={{ overflow: 'visible' }}>

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-700">Daily Progress Report</h3>
                        {canManageTasks && (
                            <button
                                onClick={() => { setShowTaskForm(true); setEditingTask(null); setTaskForm({ name: '', description: '', unit: 'pcs', defaultDailyTarget: '', totalTarget: '' }); }}
                                className="flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-0.5 rounded hover:bg-indigo-50"
                            >
                                <Plus size={12} /> Add Task
                            </button>
                        )}
                    </div>
                    <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                </div>

                {/* ── Task form (inline panel, admin only) ── */}
                {showTaskForm && (
                    <div className="px-3 py-2.5 bg-indigo-50 border-b flex flex-wrap gap-2 items-end">
                        {[
                            { label: 'Name', key: 'name', placeholder: 'e.g. Profile Cutting', w: 'w-36' },
                            { label: 'Description', key: 'description', placeholder: 'Short description…', w: 'w-52' },
                            { label: 'Unit', key: 'unit', placeholder: 'pcs', w: 'w-16' },
                        ].map(({ label, key, placeholder, w }) => (
                            <div key={key} className="flex flex-col gap-0.5">
                                <label className="text-sm font-semibold text-slate-500 uppercase">{label}</label>
                                <input autoFocus={key === 'name'} className={`border rounded px-2 py-1 text-sm ${w} focus:outline-none focus:ring-1 focus:ring-indigo-400`} placeholder={placeholder} value={taskForm[key]} onChange={e => setTaskForm(f => ({ ...f, [key]: e.target.value }))} />
                            </div>
                        ))}
                        {[
                            { label: 'Daily Target', key: 'defaultDailyTarget', placeholder: '200' },
                            { label: 'Total Target', key: 'totalTarget', placeholder: '1000' },
                        ].map(({ label, key, placeholder }) => (
                            <div key={key} className="flex flex-col gap-0.5">
                                <label className="text-sm font-semibold text-slate-500 uppercase">{label}</label>
                                <input type="number" min="0" className="border rounded px-2 py-1 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-indigo-400" placeholder={placeholder} value={taskForm[key]} onChange={e => setTaskForm(f => ({ ...f, [key]: e.target.value }))} />
                            </div>
                        ))}
                        <div className="flex gap-1.5 pb-0.5">
                            <button onClick={handleSaveTask} disabled={savingTask || !taskForm.name.trim()} className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded font-semibold hover:bg-indigo-700 disabled:opacity-50">
                                {savingTask ? '…' : editingTask ? 'Update' : 'Add'}
                            </button>
                            <button onClick={() => { setShowTaskForm(false); setEditingTask(null); }} className="text-slate-500 text-sm px-2 py-1.5 rounded hover:bg-slate-200">✕</button>
                        </div>
                    </div>
                )}

                {/* ── Empty state ── */}
                {tasks.length === 0 ? (
                    <div className="px-4 py-10 text-center text-slate-400 text-sm">
                        {canManageTasks ? 'No tasks yet. Click "Add Task" to get started.' : 'No tasks defined yet. Ask an admin to set up the task library.'}
                    </div>
                ) : (
                    <div style={{ overflow: 'visible' }}>
                        <table className="w-full text-sm" style={{ overflow: 'visible' }}>
                            <thead>
                                <tr className="border-b bg-slate-50">
                                    <th className={th} style={{ minWidth: 140 }}>Task</th>
                                    <th className={th} style={{ minWidth: 100 }}>Workers</th>
                                    <th className={`${th} text-center`} style={{ width: 100 }}>Actual</th>
                                    <th className={`${th} text-center`} style={{ minWidth: 120 }}>Today</th>
                                    <th className={`${th} text-center`} style={{ minWidth: 130 }}>Lifetime</th>
                                    <th style={{ width: 56 }}></th>
                                    {canManageTasks && <th style={{ width: 48 }}></th>}
                                </tr>
                            </thead>
                            <tbody style={{ overflow: 'visible' }}>
                                {tasks.map(task => {
                                    const row = logRows[task.id] || { workers: [], actual: 0, workerSearch: '', showDrop: false };
                                    const stats = taskTotals[task.id] || { total: 0, days: 0 };
                                    const taskEntryList = entriesByTask[task.id] || [];
                                    const isExpanded = expandedTasks.has(task.id);
                                    const todayActual = taskEntryList.filter(e => e.date === logDate).reduce((s, e) => s + (e.actualCount || 0), 0);
                                    const dailyPct = task.defaultDailyTarget > 0 ? Math.min(100, Math.round(todayActual / task.defaultDailyTarget * 100)) : null;
                                    const lifetimePct = task.totalTarget > 0 ? Math.min(100, Math.round(stats.total / task.totalTarget * 100)) : null;
                                    const workerSearch = (row.workerSearch || '').toLowerCase();
                                    const filteredEmps = employees
                                        .filter(e =>
                                            e.department?.toLowerCase() === 'factory' &&
                                            e.name?.toLowerCase().includes(workerSearch) &&
                                            !row.workers.includes(e.name)
                                        )
                                        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                                    // Allow adding a custom/temp worker if the typed name isn't already in the list
                                    const showAddCustom = workerSearch.trim().length > 0 &&
                                        !row.workers.map(w => w.toLowerCase()).includes(workerSearch.trim()) &&
                                        !filteredEmps.some(e => e.name?.toLowerCase() === workerSearch.trim());

                                    return (
                                        <React.Fragment key={task.id}>
                                            <tr
                                            className={`border-b hover:bg-slate-50/50 cursor-pointer select-none ${isExpanded ? 'bg-indigo-50/30' : ''}`}
                                            style={{ overflow: 'visible' }}
                                            onClick={e => { if (e.target.closest('button,input,a')) return; toggleExpand(task.id); }}
                                        >

                                                {/* Task + description */}
                                                <td className={td}>
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-semibold text-slate-700">{task.name}</span>
                                                        {taskEntryList.length > 0 && (
                                                            <span className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ display: 'inline-flex' }}>
                                                                <ChevronDown size={13} />
                                                            </span>
                                                        )}
                                                    </div>
                                                    {task.description && <div className="text-sm text-slate-400 mt-0.5 leading-tight max-w-[160px]">{task.description}</div>}
                                                </td>

                                                {/* Workers tag input */}
                                                <td className={td} style={{ overflow: 'visible', position: 'relative' }}>
                                                    <div className="border rounded flex flex-wrap gap-0.5 px-1.5 py-1 min-h-[28px] bg-white cursor-text focus-within:ring-1 focus-within:ring-indigo-400"
                                                        onClick={() => updRow(task.id, { showDrop: true })}>
                                                        {row.workers.map(w => (
                                                            <span key={w} className="flex items-center gap-0.5 bg-indigo-100 text-indigo-700 text-sm px-1.5 py-0.5 rounded-full">
                                                                {w}
                                                                <button onClick={ev => { ev.stopPropagation(); updRow(task.id, { workers: row.workers.filter(x => x !== w) }); }}><X size={9} /></button>
                                                            </span>
                                                        ))}
                                                        <input
                                                            className="flex-1 min-w-[36px] text-sm outline-none bg-transparent"
                                                            placeholder={row.workers.length === 0 ? 'Add…' : ''}
                                                            value={row.workerSearch || ''}
                                                            onChange={e => updRow(task.id, { workerSearch: e.target.value, showDrop: true })}
                                                            onFocus={() => updRow(task.id, { showDrop: true })}
                                                            onBlur={() => setTimeout(() => updRow(task.id, { showDrop: false }), 150)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    const trimmed = (row.workerSearch || '').trim();
                                                                    if (trimmed && !row.workers.includes(trimmed)) {
                                                                        updRow(task.id, { workers: [...row.workers, trimmed], workerSearch: '', showDrop: false });
                                                                    }
                                                                    e.preventDefault();
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    {row.showDrop && (filteredEmps.length > 0 || showAddCustom) && (
                                                        <div className="absolute left-0 right-0 top-full mt-0.5 bg-white border rounded shadow-lg z-30 max-h-36 overflow-y-auto">
                                                            {filteredEmps.map(emp => (
                                                                <button key={emp.id} className="w-full text-left px-2 py-1.5 text-sm hover:bg-indigo-50 text-slate-700"
                                                                    onMouseDown={() => updRow(task.id, { workers: [...row.workers, emp.name], workerSearch: '' })}>
                                                                    {emp.name}
                                                                </button>
                                                            ))}
                                                            {showAddCustom && (
                                                                <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-amber-50 text-amber-700 border-t"
                                                                    onMouseDown={() => { const t = (row.workerSearch || '').trim(); updRow(task.id, { workers: [...row.workers, t], workerSearch: '', showDrop: false }); }}>
                                                                    + Add "{(row.workerSearch || '').trim()}" as temp worker
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Actual stepper */}
                                                <td className={`${td} text-center`}>
                                                    <div className="flex items-center border rounded overflow-hidden mx-auto" style={{ width: 100 }}>
                                                        <button onClick={() => updRow(task.id, { actual: Math.max(0, Number(row.actual) - 1) })} className="px-2 py-2bg-slate-50 hover:bg-slate-100 border-r text-slate-500"><Minus size={11} /></button>
                                                        <input
                                                            type="number" min="0"
                                                            value={row.actual}
                                                            onChange={e => updRow(task.id, { actual: e.target.value })}
                                                            className="w-0 flex-1 text-center text-sm py-1 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                        <button onClick={() => updRow(task.id, { actual: Number(row.actual) + 1 })} className="px-2 py-2bg-slate-50 hover:bg-slate-100 border-l text-slate-500"><Plus size={11} /></button>
                                                    </div>
                                                </td>

                                                {/* Today's progress vs daily target */}
                                                <td className={`${td} text-center`}>
                                                    {task.defaultDailyTarget > 0 ? (
                                                        <div>
                                                            <span className={`font-semibold ${dailyPct != null && dailyPct >= 100 ? 'text-green-600' : 'text-indigo-700'}`}>{todayActual}</span>
                                                            <span className="text-slate-400 text-sm"> / {task.defaultDailyTarget} {task.unit}</span>
                                                            <div className="mt-1">
                                                                <div className="h-1 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${dailyPct != null && dailyPct >= 100 ? 'bg-green-500' : 'bg-indigo-400'}`} style={{ width: `${dailyPct ?? 0}%` }} /></div>
                                                                <div className={`text-sm mt-0.5 font-bold ${dailyPct != null && dailyPct >= 100 ? 'text-green-600' : 'text-indigo-500'}`}>{dailyPct ?? 0}%</div>
                                                            </div>
                                                        </div>
                                                    ) : <span className="text-slate-300">—</span>}
                                                </td>

                                                {/* Lifetime progress */}
                                                <td className={`${td} text-center`}>
                                                    {task.totalTarget > 0 ? (
                                                        <div>
                                                            <span className="font-semibold text-indigo-700">{stats.total}</span>
                                                            <span className="text-slate-400 text-sm"> / {task.totalTarget} {task.unit}</span>
                                                            {lifetimePct !== null && (
                                                                <div className="mt-1">
                                                                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${lifetimePct >= 100 ? 'bg-green-500' : 'bg-teal-400'}`} style={{ width: `${lifetimePct}%` }} /></div>
                                                                    <div className={`text-sm mt-0.5 font-bold ${lifetimePct >= 100 ? 'text-green-600' : 'text-teal-600'}`}>{lifetimePct}%</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="font-semibold text-indigo-700">{stats.total} <span className="font-normal text-slate-400 text-sm">{task.unit}</span></span>
                                                    )}
                                                    {stats.days > 0 && <div className="text-sm text-slate-300 mt-0.5">{stats.days} {stats.days === 1 ? 'entry' : 'entries'}</div>}
                                                </td>

                                                {/* Log */}
                                                <td className={`${td} text-center`}>
                                                    <button onClick={() => handleLogRow(task.id)} disabled={savingRow === task.id} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-2.5 py-1 rounded disabled:opacity-50">
                                                        {savingRow === task.id ? '…' : 'Log'}
                                                    </button>
                                                </td>

                                                {/* Admin actions */}
                                                {canManageTasks && (
                                                    <td className={`${td} text-center`}>
                                                        <div className="flex gap-0.5 justify-center">
                                                            <button onClick={() => { setEditingTask(task); setTaskForm({ name: task.name, description: task.description || '', unit: task.unit || 'pcs', defaultDailyTarget: String(task.defaultDailyTarget || ''), totalTarget: String(task.totalTarget || '') }); setShowTaskForm(true); }} className="p-1 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Edit size={13} /></button>
                                                            <button onClick={async () => { if (window.confirm('Delete task?')) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'boqs', boq.id, 'dpr_tasks', task.id)); }} className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>

                                            {/* Accordion: entry history for this task */}
                                            {isExpanded && (
                                                <tr className="bg-slate-50/70">
                                                    <td colSpan={colCount} className="px-6 py-2 border-b">
                                                        {taskEntryList.length === 0 ? (
                                                            <span className="text-sm text-slate-400">No entries yet.</span>
                                                        ) : (
                                                            <table className="w-full text-sm">
                                                                <thead>
                                                                    <tr className="text-sm text-slate-400 uppercase">
                                                                        <th className="pb-1 text-left font-bold pr-4">Date</th>
                                                                        <th className="pb-1 text-left font-bold pr-4">Workers</th>
                                                                        <th className="pb-1 text-center font-bold pr-4">Actual / Target</th>
                                                                        <th className="pb-1 text-center font-bold w-20">Progress</th>
                                                                        <th className="pb-1 text-right font-bold">By</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100">
                                                                    {taskEntryList.map(e => {
                                                                        const pct = e.targetCount > 0 ? Math.min(100, Math.round(e.actualCount / e.targetCount * 100)) : null;
                                                                        return (
                                                                            <tr key={e.id}>
                                                                                <td className="py-1.5 pr-4 text-slate-600 font-medium whitespace-nowrap">{fmtTs(e.createdAt)}</td>
                                                                                <td className="py-1.5 pr-4">
                                                                                    <div className="flex flex-wrap gap-0.5">
                                                                                        {e.workers?.length > 0 ? e.workers.map(w => <span key={w} className="text-sm bg-white border text-slate-500 px-1.5 py-0.5 rounded">{w}</span>) : <span className="text-slate-300">—</span>}
                                                                                    </div>
                                                                                </td>
                                                                                <td className={`py-1.5 pr-4 text-center font-bold ${pct != null && pct >= 100 ? 'text-green-600' : 'text-indigo-700'}`}>
                                                                                    {e.actualCount} / {e.targetCount} {e.unit}
                                                                                </td>
                                                                                <td className="py-1.5 text-center">
                                                                                    {pct !== null ? (
                                                                                        <div className="flex flex-col items-center gap-0.5">
                                                                                            <span className={`text-sm font-bold ${pct >= 100 ? 'text-green-600' : 'text-indigo-600'}`}>{pct}%</span>
                                                                                            <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden"><div className={`h-full ${pct >= 100 ? 'bg-green-500' : 'bg-indigo-400'}`} style={{ width: `${pct}%` }} /></div>
                                                                                        </div>
                                                                                    ) : '—'}
                                                                                </td>
                                                                                <td className="py-1.5 text-right text-slate-400 whitespace-nowrap">{e.createdBy}</td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main App Component ---


const ReportingTracker = ({ user: globalUser, perms = {} }) => {
    const loading = false;
    const [activeBOQ, setActiveBOQ] = useState(null);
    const [showUserMan, setShowUserMan] = useState(false);

    // Map perms to the tracker's internal role model
    const getTrackerRole = () => {
        if (perms['boq.create']) return ROLES.ADMIN;
        if (perms['boq.updateFactoryStatus'] && perms['boq.updateSiteStatus']) return ROLES.DUAL;
        if (perms['boq.updateFactoryStatus']) return ROLES.FACTORY;
        if (perms['boq.updateSiteStatus']) return ROLES.SITE;
        return ROLES.SITE; // view-only: most restricted worker
    };

    const user = {
        username: globalUser?.username || globalUser?.email?.split('@')[0] || 'user',
        role: getTrackerRole()
    };

    if (loading) return <Loading />;

    if (showUserMan) return <UserManagement onClose={() => setShowUserMan(false)} />;

    if (activeBOQ) {
        return (
            <BOQManager
                boq={activeBOQ}
                user={user}
                onBack={() => setActiveBOQ(null)}
            />
        );
    }

    return (
        <Dashboard
            user={user}
            onViewBOQ={setActiveBOQ}
            onManageUsers={() => setShowUserMan(true)}
            onLogout={() => { }} // Controlled by main app
        />
    );
};

export default ReportingTracker;
