import React from 'react';

// Detects failed dynamic-import fetches — happens when a deploy replaces hashed
// chunk files while a user still has the old index.html open in a tab.
const isChunkLoadError = (err) =>
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk/i
    .test(err?.message || '');

// Catches lazy-chunk load failures (and any render crash) below it and offers a
// reload instead of a blank screen. Reloading fetches the new index.html, which
// points at the current chunk hashes.
export default class ChunkErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const stale = isChunkLoadError(error);
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
          {stale ? 'A new version of the app is available' : 'Something went wrong loading this screen'}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {stale ? 'Please reload to get the latest version.' : (error.message || 'Unknown error')}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold"
        >
          Reload
        </button>
      </div>
    );
  }
}
