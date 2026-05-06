/**
 * Blog API integration for Libentia.
 * Powers the paginated all-posts page and exposes helpers for single posts.
 */
class BlogAPI {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'https://e1app.edoubleone.com/api/v1/libentia-health';
    this.containerId = options.containerId || 'libentia-blog-posts';
    this.postsPerPage = options.postsPerPage || 6;
    this.autoLoad = options.autoLoad !== false;
    this.currentPage = 1;
    this.lastPage = 1;
    this.totalPosts = 0;
    this.posts = [];
    this.filters = {};
    this.config = null;
    this.ready = this.init();
  }

  async init() {
    try {
      await this.fetchConfig();

      if (this.autoLoad && document.getElementById(this.containerId)) {
        await this.loadPosts(this.currentPage, this.getUrlFilters());
      }
    } catch (error) {
      console.error('Blog API initialization error:', error);
      this.showError('Failed to load blog posts');
    }
  }

  async fetchConfig() {
    try {
      const response = await fetch(`${this.baseURL}/config`);
      if (!response.ok) throw new Error('Failed to fetch config');

      const result = await response.json();
      this.config = result.data;
      this.applyBranding();
      return this.config;
    } catch (error) {
      console.warn('Could not fetch blog config:', error);
      return null;
    }
  }

  applyBranding() {
    if (!this.config || !this.config.branding) return;

    const container = document.getElementById(this.containerId) || document.documentElement;
    const branding = this.config.branding;

    container.style.setProperty('--blog-primary', branding.primary_color || '#1e3a5f');
    container.style.setProperty('--blog-accent', branding.accent_color || '#3b82f6');
    container.style.setProperty('--blog-text', branding.text_color || '#111827');
    container.style.setProperty('--blog-bg', branding.background_color || '#ffffff');
    if (branding.font_heading) container.style.setProperty('--blog-font-head', `'${branding.font_heading}', sans-serif`);
    if (branding.font_body) container.style.setProperty('--blog-font-body', `'${branding.font_body}', sans-serif`);
  }

  async loadPosts(page = 1, filters = {}) {
    try {
      this.filters = { ...this.filters, ...filters };

      const params = new URLSearchParams({
        page,
        per_page: this.filters.per_page || this.postsPerPage
      });

      Object.entries(this.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, value);
        }
      });

      const response = await fetch(`${this.baseURL}/posts?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch posts');

      const result = await response.json();
      this.posts = result.data || [];
      this.currentPage = result.meta?.current_page || page;
      this.lastPage = result.meta?.last_page || 1;
      this.totalPosts = result.meta?.total || this.posts.length;

      this.render();
      return result;
    } catch (error) {
      console.error('Error loading posts:', error);
      this.showError('Failed to load blog posts');
      return null;
    }
  }

  async fetchPost(slug) {
    try {
      const response = await fetch(`${this.baseURL}/posts/${encodeURIComponent(slug)}`);
      if (!response.ok) throw new Error('Post not found');

      const result = await response.json();
      return result.data || null;
    } catch (error) {
      console.error('Error fetching post:', error);
      return null;
    }
  }

  async fetchCategories() {
    return this.fetchCollection('categories');
  }

  async fetchTags() {
    return this.fetchCollection('tags');
  }

  async fetchAuthors() {
    return this.fetchCollection('authors');
  }

  async fetchCollection(endpoint) {
    try {
      const response = await fetch(`${this.baseURL}/${endpoint}`);
      if (!response.ok) throw new Error(`Failed to fetch ${endpoint}`);

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      return [];
    }
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    if (!this.posts.length) {
      container.innerHTML = '<p class="text-center">No posts found.</p>';
      return;
    }

    const blogGrid = document.createElement('div');
    blogGrid.className = 'blog-grid row';
    this.posts.forEach(post => blogGrid.appendChild(this.createPostCard(post)));

    container.innerHTML = '';
    container.appendChild(blogGrid);

    if (this.lastPage > 1) {
      container.appendChild(this.createPagination());
    }
  }

  createPostCard(post) {
    const col = document.createElement('div');
    col.className = 'col-lg-4 col-md-6 mb-4';

    const card = document.createElement('div');
    card.className = 'blog-card h-100';

    const coverHTML = post.cover_image ? `
      <div class="blog-card-image">
        <a href="blog-details.html?slug=${encodeURIComponent(post.slug)}">
          <img src="${this.escapeHtml(post.cover_image)}" alt="${this.escapeHtml(post.title)}" class="img-fluid">
        </a>
      </div>
    ` : '';

    const postDate = post.published_at ? new Date(post.published_at) : null;
    const formattedDate = postDate && !Number.isNaN(postDate.valueOf())
      ? postDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    const categoriesHTML = post.categories?.length ? `
      <div class="blog-categories">
        ${post.categories.map(cat => `
          <a class="badge badge-primary" href="our-blog.html?category=${encodeURIComponent(cat.slug)}">
            ${this.escapeHtml(cat.name)}
          </a>
        `).join('')}
      </div>
    ` : '';

    const tagsHTML = post.tags?.length ? `
      <div class="blog-tags mt-2">
        ${post.tags.map(tag => `
          <a href="our-blog.html?tag=${encodeURIComponent(tag.slug)}" class="badge badge-light">
            #${this.escapeHtml(tag.name)}
          </a>
        `).join('')}
      </div>
    ` : '';

    const authorHTML = post.author ? `
      <div class="blog-author mt-3">
        <small class="text-muted">By <strong>${this.escapeHtml(post.author.name)}</strong></small>
      </div>
    ` : '';

    const readingTimeHTML = post.reading_time_minutes ? `
      <small class="text-muted ms-2">&bull; ${this.escapeHtml(post.reading_time_minutes)} min read</small>
    ` : '';

    card.innerHTML = `
      ${coverHTML}
      <div class="blog-card-body p-4">
        ${categoriesHTML}
        <h3 class="blog-card-title mt-3">
          <a href="blog-details.html?slug=${encodeURIComponent(post.slug)}" class="text-decoration-none">
            ${this.escapeHtml(post.title)}
          </a>
        </h3>
        <p class="blog-card-excerpt text-muted mt-2">${this.escapeHtml(post.excerpt)}</p>
        <div class="blog-card-meta mt-3">
          <small class="text-muted">${formattedDate}${readingTimeHTML}</small>
        </div>
        ${authorHTML}
        ${tagsHTML}
        <a href="blog-details.html?slug=${encodeURIComponent(post.slug)}" class="btn btn-sm btn-primary mt-3">
          Read More <i class="fa-solid fa-arrow-right ms-2"></i>
        </a>
      </div>
    `;

    col.appendChild(card);
    return col;
  }

  createPagination() {
    const paginationContainer = document.createElement('nav');
    paginationContainer.className = 'blog-pagination mt-5';
    paginationContainer.setAttribute('aria-label', 'Blog pagination');

    const ul = document.createElement('ul');
    ul.className = 'pagination justify-content-center';

    if (this.currentPage > 1) {
      ul.appendChild(this.createPageItem(this.currentPage - 1, 'Previous', 'fa-chevron-left'));
    }

    for (let page = 1; page <= this.lastPage; page += 1) {
      ul.appendChild(this.createPageItem(page, String(page), null, page === this.currentPage));
    }

    if (this.currentPage < this.lastPage) {
      ul.appendChild(this.createPageItem(this.currentPage + 1, 'Next', 'fa-chevron-right'));
    }

    ul.querySelectorAll('a[data-page]').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        this.loadPosts(parseInt(link.dataset.page, 10), this.filters);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    paginationContainer.appendChild(ul);
    return paginationContainer;
  }

  createPageItem(page, label, icon, active = false) {
    const li = document.createElement('li');
    li.className = `page-item${active ? ' active' : ''}`;

    const leftIcon = icon === 'fa-chevron-left' ? `<i class="fa-solid ${icon} me-2"></i>` : '';
    const rightIcon = icon === 'fa-chevron-right' ? `<i class="fa-solid ${icon} ms-2"></i>` : '';
    li.innerHTML = `<a class="page-link" href="#" data-page="${page}">${leftIcon}${label}${rightIcon}</a>`;
    return li;
  }

  showError(message) {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.innerHTML = `<div class="alert alert-danger" role="alert">${this.escapeHtml(message)}</div>`;
    }
  }

  escapeHtml(text) {
    if (text === null || text === undefined) return '';

    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, char => map[char]);
  }

  getUrlFilters() {
    const params = new URLSearchParams(window.location.search);
    const filters = {};
    ['category', 'tag', 'author', 'featured', 'search'].forEach(key => {
      const value = params.get(key);
      if (value) filters[key] = value;
    });
    return filters;
  }

  resetAndLoad(filters) {
    this.currentPage = 1;
    this.filters = {};
    return this.loadPosts(1, filters);
  }

  filterByCategory(categorySlug) {
    return this.resetAndLoad({ category: categorySlug });
  }

  filterByTag(tagSlug) {
    return this.resetAndLoad({ tag: tagSlug });
  }

  filterByAuthor(authorSlug) {
    return this.resetAndLoad({ author: authorSlug });
  }

  search(query) {
    return this.resetAndLoad({ search: query });
  }

  getFeaturedPosts() {
    return this.resetAndLoad({ featured: 1 });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const blogContainer = document.getElementById('libentia-blog-posts');
  window.blogAPI = new BlogAPI({
    baseURL: 'https://e1app.edoubleone.com/api/v1/libentia-health',
    containerId: 'libentia-blog-posts',
    postsPerPage: 6,
    autoLoad: Boolean(blogContainer)
  });
  window.escapeHtml = text => window.blogAPI.escapeHtml(text);
});
