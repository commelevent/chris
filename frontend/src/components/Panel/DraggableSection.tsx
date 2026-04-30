import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DragOutlined, LockOutlined, DeleteOutlined, CheckOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import styles from './DraggableSection.module.scss';

interface DraggableSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  isConfigMode?: boolean;
  isFixed?: boolean;
  isHidden?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string, isFixed: boolean) => void;
  onDelete?: (id: string) => void;
  onToggleHidden?: (id: string) => void;
  customStyles?: Record<string, any>;
}

const DraggableSection: React.FC<DraggableSectionProps> = ({
  id,
  title,
  subtitle,
  children,
  className,
  isConfigMode = false,
  isFixed = false,
  isHidden = false,
  isSelected = false,
  onSelect,
  onDelete,
  onToggleHidden,
  customStyles,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id,
    disabled: isFixed,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...customStyles,
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && !isFixed) {
      onDelete(id);
    }
  };

  const handleToggleHidden = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleHidden && isFixed) {
      onToggleHidden(id);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isConfigMode && onSelect && !isFixed) {
      e.stopPropagation();
      onSelect(id, isFixed);
    }
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={`${styles.section} ${className || ''} ${isDragging ? styles.dragging : ''} ${isConfigMode ? styles.configMode : ''} ${isFixed ? styles.fixed : ''} ${isSelected ? styles.selected : ''} ${isHidden ? styles.hidden : ''}`}
    >
      {isSelected && !isFixed && (
        <div className={styles.selectedIndicator}>
          <CheckOutlined />
        </div>
      )}
      <div className={styles.header}>
        {isConfigMode && (
          <div className={styles.dragHandleWrapper}>
            {isFixed ? (
              <div className={styles.fixedIcon}>
                <LockOutlined />
              </div>
            ) : (
              <div
                {...attributes}
                {...listeners}
                className={styles.dragHandle}
              >
                <DragOutlined />
              </div>
            )}
          </div>
        )}
        <h2>{title}</h2>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        {isConfigMode && isFixed && (
          <span className={styles.fixedBadge}>固定</span>
        )}
        {isConfigMode && isHidden && (
          <span className={styles.hiddenBadge}>已隐藏</span>
        )}
        {isConfigMode && isFixed && onToggleHidden && (
          <button
            className={styles.toggleHiddenButton}
            onClick={handleToggleHidden}
            title={isHidden ? '显示此面板' : '隐藏此面板'}
          >
            {isHidden ? <EyeOutlined /> : <EyeInvisibleOutlined />}
          </button>
        )}
        {isConfigMode && !isFixed && onDelete && (
          <button
            className={styles.deleteButton}
            onClick={handleDelete}
            title="删除此面板"
          >
            <DeleteOutlined />
          </button>
        )}
      </div>
      <div className={styles.content}>{children}</div>
    </section>
  );
};

export default DraggableSection;
