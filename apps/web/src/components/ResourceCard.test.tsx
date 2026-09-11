import type { Resource } from '@aifs/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ResourceCard } from './ResourceCard.js';

const resource: Resource = {
  id: 'rag-hf',
  title: 'Hugging Face LLM Course',
  url: 'https://huggingface.co/learn/llm-course',
  provider: 'Hugging Face',
  language: 'en',
  difficulty: 'intermediate',
  format: 'course',
  durationHours: 12,
  topics: ['rag', 'transformers'],
  stage: 'rag',
  scope: 'curriculum',
  description: '从零讲清楚 Transformer 与检索增强生成。',
  notes: '免费开放，无需注册',
  verified: true,
};

describe('ResourceCard', () => {
  it('展示标题、提供方、说明与元信息', () => {
    render(<ResourceCard resource={resource} />);

    expect(screen.getByRole('heading', { name: 'Hugging Face LLM Course' })).toBeInTheDocument();
    expect(screen.getByText(/Hugging Face · huggingface\.co/)).toBeInTheDocument();
    expect(screen.getByText('从零讲清楚 Transformer 与检索增强生成。')).toBeInTheDocument();
    expect(screen.getByText('免费开放，无需注册')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('进阶')).toBeInTheDocument();
    expect(screen.getByText('课程')).toBeInTheDocument();
    expect(screen.getByText('12 小时')).toBeInTheDocument();
  });

  it('外链带 noopener noreferrer 并在新标签打开', () => {
    render(<ResourceCard resource={resource} />);
    const link = screen.getByRole('link', { name: 'Hugging Face LLM Course' });

    expect(link).toHaveAttribute('href', 'https://huggingface.co/learn/llm-course');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noreferrer');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('未核实的链接会给出显式警告', () => {
    render(<ResourceCard resource={{ ...resource, verified: false }} />);
    expect(screen.getByText(/链接未核实/)).toBeInTheDocument();
  });

  it('完整体系课会带上醒目的标记', () => {
    render(<ResourceCard resource={{ ...resource, scope: 'curriculum' }} />);
    expect(screen.getByText(/完整体系课/)).toBeInTheDocument();
  });

  it('单点补充不显示体系课标记（避免刷屏式徽章）', () => {
    render(<ResourceCard resource={{ ...resource, scope: 'supplement' }} />);
    expect(screen.queryByText(/完整体系课/)).not.toBeInTheDocument();
  });

  it('没有交互回调时不渲染进度按钮', () => {
    render(<ResourceCard resource={resource} />);
    expect(screen.queryByRole('button', { name: '想学' })).not.toBeInTheDocument();
  });

  it('点击状态按钮会把对应状态回调出去', async () => {
    const user = userEvent.setup();
    const onSelectStatus = vi.fn();

    render(<ResourceCard resource={resource} onSelectStatus={onSelectStatus} />);

    await user.click(screen.getByRole('button', { name: '在学' }));
    expect(onSelectStatus).toHaveBeenCalledWith('learning');

    await user.click(screen.getByRole('button', { name: '已完成' }));
    expect(onSelectStatus).toHaveBeenLastCalledWith('completed');
  });

  it('当前状态对应按钮为按下态，并出现「清除」按钮', () => {
    const onClearStatus = vi.fn();
    render(
      <ResourceCard
        resource={resource}
        status="learning"
        onSelectStatus={vi.fn()}
        onClearStatus={onClearStatus}
      />,
    );

    expect(screen.getByRole('button', { name: '在学' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '想学' })).toHaveAttribute('aria-pressed', 'false');
    // 角标 + 按钮各出现一次「在学」
    expect(screen.getAllByText('在学').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: '清除' })).toBeInTheDocument();
  });

  it('请求进行中时按钮禁用，避免重复提交', () => {
    render(<ResourceCard resource={resource} busy onSelectStatus={vi.fn()} />);
    expect(screen.getByRole('button', { name: '想学' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '已完成' })).toBeDisabled();
  });
});
