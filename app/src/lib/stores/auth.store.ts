import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Check if we're in the browser and if the user is already authenticated
const initialState = browser ? localStorage.getItem('planeoAuthenticated') === 'true' : false;

// Create the authentication store
export const isAuthenticated = writable<boolean>(initialState);

// Subscribe to changes and update localStorage
if (browser) {
  isAuthenticated.subscribe((value) => {
    localStorage.setItem('planeoAuthenticated', value.toString());
  });
}
