import { describe, it, expect, vi } from 'vitest';
import { Select, SelectItem, EMPTY_SELECT_VALUE } from './select';

describe('Select with empty string value support', () => {
  it('exports EMPTY_SELECT_VALUE sentinel', () => {
    expect(EMPTY_SELECT_VALUE).toBeDefined();
    expect(typeof EMPTY_SELECT_VALUE).toBe('string');
    expect(EMPTY_SELECT_VALUE.length).toBeGreaterThan(0);
  });

  it('maps empty string value to EMPTY_SELECT_VALUE sentinel and back on value change', () => {
    const onValueChange = vi.fn();
    const rendered = (Select as any)({
      value: '',
      defaultValue: '',
      onValueChange,
    });

    expect(rendered.props.value).toBe(EMPTY_SELECT_VALUE);
    expect(rendered.props.defaultValue).toBe(EMPTY_SELECT_VALUE);

    rendered.props.onValueChange(EMPTY_SELECT_VALUE);
    expect(onValueChange).toHaveBeenCalledWith('');

    rendered.props.onValueChange('cat-1');
    expect(onValueChange).toHaveBeenCalledWith('cat-1');
  });

  it('maps SelectItem empty string value to EMPTY_SELECT_VALUE', () => {
    const item = (SelectItem as any).render(
      { value: '', children: 'Sem categoria' },
      null
    );
    expect(item.props.value).toBe(EMPTY_SELECT_VALUE);

    const normalItem = (SelectItem as any).render(
      { value: 'cat-1', children: 'Alimentação' },
      null
    );
    expect(normalItem.props.value).toBe('cat-1');
  });
});
