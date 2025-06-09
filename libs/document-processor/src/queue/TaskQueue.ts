import { TinyQueue } from '../utils/TinyQueue';
import { Task } from '../types';
import { compareTasks } from './TaskKey';

/**
 * Priority queue for tasks with deterministic ordering
 *
 * Wraps TinyQueue to provide a consistent interface for
 * managing prioritized tasks in the document processor.
 */
export class TaskQueue {
  private readonly queue: TinyQueue<Task>;

  /**
   * Creates a new task queue with the task key comparator
   */
  constructor() {
    this.queue = new TinyQueue<Task>([], compareTasks);
  }

  /**
   * Adds a task to the queue
   *
   * @param task - The task to add
   */
  push(task: Task): void {
    this.queue.push(task);
  }

  /**
   * Removes and returns the highest priority task
   *
   * @returns The highest priority task or undefined if queue is empty
   */
  pop(): Task | undefined {
    return this.queue.pop();
  }

  /**
   * Gets the number of tasks in the queue
   */
  get length(): number {
    return this.queue.length;
  }
}
