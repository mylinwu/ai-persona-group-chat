import React from 'react';
// fix: Corrected import path to resolve module.
import { AvatarConfig } from '../types/index';
// fix: Corrected import path to resolve module.
import { DEFAULT_AVATAR } from '../constants/index';

interface PersonaAvatarProps {
  src?: AvatarConfig;
  name: string;
  size?: 'sm' | 'md';
}

const PersonaAvatar: React.FC<PersonaAvatarProps> = ({ src = DEFAULT_AVATAR, name, size = 'md' }) => {
  const sizeClasses = size === 'md' ? 'h-10 w-10 text-xl' : 'h-8 w-8 text-lg';
  
  return (
    <div
      className={`${sizeClasses} rounded-full flex items-center justify-center flex-shrink-0`}
      style={{
        backgroundColor: src.bgColor,
        color: src.color,
      }}
      title={name}
    >
      <span role="img" aria-label={name}>{src.icon}</span>
    </div>
  );
};

export default PersonaAvatar;