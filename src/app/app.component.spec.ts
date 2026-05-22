import { AppComponent } from './app.component';

describe('frontend test harness', () => {
  it('runs the root workspace tests', () => {
    const component = new AppComponent();

    expect(component.title).toBe('frontend');
  });
});
