import { useState, useEffect } from 'react';
// fix: Corrected import path to resolve module.
import { Persona } from '../types/index';
// fix: Corrected import path to resolve module.
import { DEFAULT_PERSONAS, DEFAULT_AVATAR } from '../constants/index';

const LOCAL_STORAGE_KEY = 'ai-persona-chat-personas';

export const usePersonas = () => {
  const [personas, setPersonas] = useState<Persona[]>(() => {
    try {
      const storedPersonas = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      return storedPersonas ? JSON.parse(storedPersonas) : DEFAULT_PERSONAS;
    } catch (error) {
      console.error('Error reading personas from localStorage', error);
      return DEFAULT_PERSONAS;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(personas));
    } catch (error) {
      console.error('Error writing personas to localStorage', error);
    }
  }, [personas]);

  const addPersona = (persona: Omit<Persona, 'id' | 'avatar'> & { avatar?: Partial<Persona['avatar']> }) => {
    const newPersona: Persona = { 
      ...persona, 
      id: new Date().toISOString(),
      avatar: {
        ...DEFAULT_AVATAR,
        ...persona.avatar
      }
    };
    setPersonas((prev) => [...prev, newPersona]);
  };

  const updatePersona = (updatedPersona: Persona) => {
    setPersonas((prev) =>
      prev.map((p) => (p.id === updatedPersona.id ? updatedPersona : p))
    );
  };

  const deletePersona = (id: string) => {
    setPersonas((prev) => prev.filter((p) => p.id !== id));
  };

  return { personas, addPersona, updatePersona, deletePersona, setPersonas };
};