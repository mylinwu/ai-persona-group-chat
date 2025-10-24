import { useState, useCallback } from 'react';
// fix: Corrected import path to resolve module.
import { Persona } from '../types/index';
// fix: Corrected import path to resolve module.
import { CONVERSATION_DIRECTIONS } from '../constants/index';

export const useChatInput = (activePersonas: Persona[]) => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    const match = value.match(/([@#])(\w*)$/);
    if (match) {
        const trigger = match[1];
        const query = match[2].toLowerCase();
        if (trigger === '@') {
            const newSuggestions = activePersonas
                .map(p => p.name)
                .filter(name => name.toLowerCase().includes(query));
            setSuggestions(newSuggestions);
            setShowSuggestions(newSuggestions.length > 0);
        } else if (trigger === '#') {
            const newSuggestions = CONVERSATION_DIRECTIONS
                .filter(d => d.toLowerCase().includes(query));
            setSuggestions(newSuggestions);
            setShowSuggestions(newSuggestions.length > 0);
        }
        setActiveSuggestionIndex(0);
    } else {
        setShowSuggestions(false);
    }
  }, [activePersonas]);

  const completeSuggestion = useCallback((suggestion: string): { type: '@' | '#', newInputValue: string } | null => {
    const match = input.match(/([@#])\w*$/);
    if (match) {
        const trigger = match[1] as '@' | '#';
        const baseInput = input.slice(0, input.lastIndexOf(trigger));
        if (trigger === '#') {
            return { type: '#', newInputValue: baseInput.trimEnd() };
        } else { // trigger is '@'
            const newInput = `${baseInput}${trigger}${suggestion} `;
            return { type: '@', newInputValue: newInput };
        }
    }
    return null;
  }, [input]);

  return {
    input,
    setInput,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    activeSuggestionIndex,
    setActiveSuggestionIndex,
    handleInputChange,
    completeSuggestion,
  };
};