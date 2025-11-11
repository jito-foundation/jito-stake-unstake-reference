import React from 'react';
import classNames from 'classnames';

interface ButtonProps {
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  loading?: boolean;
  label: string;
  width?: 'full' | 'fit';
  kind?: 'primary' | 'secondary' | 'outline' | 'bare';
}

const Button: React.FC<ButtonProps> = ({
  type = 'button',
  onClick,
  disabled = false,
  className = '',
  loading = false,
  label,
  width = 'fit',
  kind = 'primary',
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={classNames(
        'relative rounded-lg font-medium transition duration-150 flex justify-center items-center',
        'px-6 py-2.5 text-base',
        {
          'w-full': width === 'full',
          'w-fit': width === 'fit',
          'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-purple-300': kind === 'primary',
          'bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400':
            kind === 'secondary',
          'border border-purple-600 bg-transparent text-purple-600 hover:bg-purple-50 disabled:border-purple-300 disabled:text-purple-300':
            kind === 'outline',
          'bg-transparent text-purple-600 hover:text-purple-700 disabled:text-gray-400 p-0': kind === 'bare',
          'opacity-70 cursor-not-allowed': disabled,
        },
        className
      )}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
        </div>
      )}
      <span className={loading ? 'opacity-0' : ''}>{label}</span>
    </button>
  );
};

export default Button;
