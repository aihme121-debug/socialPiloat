import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const limit = searchParams.get('limit') || '10';

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { business: true }
    });

    if (!user?.business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 });
    }

    // Get Facebook social accounts
    const socialAccounts = await prisma.socialAccount.findMany({
      where: {
        businessId: user.business.id,
        platform: 'FACEBOOK'
      }
    });

    if (socialAccounts.length === 0) {
      return NextResponse.json({ error: 'No Facebook accounts found' }, { status: 404 });
    }

    const selectedPageId = pageId || socialAccounts[0].accountId;
    const account = socialAccounts.find(acc => acc.accountId === selectedPageId) || socialAccounts[0];

    // Get posts from database first
    const posts = await prisma.post.findMany({
      where: {
        businessId: user.business.id,
        platforms: { has: 'FACEBOOK' },
        status: 'PUBLISHED'
      },
      include: {
        content: {
          select: {
            contentText: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    // If we have access token, fetch fresh data from Facebook
    if (account.accessToken) {
      try {
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${selectedPageId}/posts?fields=id,message,created_time,likes.summary(true),comments.summary(true),shares,attachments&limit=${limit}&access_token=${account.accessToken}`
        );

        if (response.ok) {
          const data = await response.json();
          
          // Fetch comments for each post
          const postsWithComments = await Promise.all(
            data.data.map(async (post: any) => {
              try {
                const commentsResponse = await fetch(
                  `https://graph.facebook.com/v18.0/${post.id}/comments?fields=id,message,from,created_time,like_count&order=reverse_chronological&limit=50&access_token=${account.accessToken}`
                );

                let comments = [];
                if (commentsResponse.ok) {
                  const commentsData = await commentsResponse.json();
                  comments = commentsData.data || [];
                }

                return {
                  id: post.id,
                  message: post.message || 'No content',
                  createdTime: post.created_time,
                  likes: post.likes?.summary?.total_count || 0,
                  commentsCount: post.comments?.summary?.total_count || 0,
                  shares: post.shares?.count || 0,
                  attachments: post.attachments?.data || [],
                  comments: comments.map((comment: any) => ({
                    id: comment.id,
                    message: comment.message,
                    from: comment.from,
                    createdTime: comment.created_time,
                    likeCount: comment.like_count || 0,
                    canReply: true
                  }))
                };
              } catch (error) {
                console.error('Error fetching comments for post:', post.id, error);
                return {
                  id: post.id,
                  message: post.message || 'No content',
                  createdTime: post.created_time,
                  likes: post.likes?.summary?.total_count || 0,
                  commentsCount: post.comments?.summary?.total_count || 0,
                  shares: post.shares?.count || 0,
                  attachments: post.attachments?.data || [],
                  comments: []
                };
              }
            })
          );

          return NextResponse.json({
            posts: postsWithComments,
            pageInfo: data.paging || {},
            account: {
              id: account.id,
              name: account.accountName,
              platformId: account.accountId,
              profileImageUrl: (account.settings as any)?.profileImageUrl || ''
            }
          });
        }
      } catch (error) {
        console.error('Error fetching from Facebook:', error);
      }
    }

    // Fallback to database posts
    const fallbackPosts = posts.map(post => ({
      id: post.id,
      message: post.content?.contentText || 'No content',
      createdTime: post.createdAt,
      likes: 0,
      commentsCount: 0,
      shares: 0,
      attachments: [],
      comments: []
    }));

    return NextResponse.json({
      posts: fallbackPosts,
      pageInfo: {},
      account: {
        id: account.id,
        name: account.accountName,
        platformId: account.accountId,
        profileImageUrl: (account.settings as any)?.profileImageUrl || ''
      },
      fallback: true
    });

  } catch (error) {
    console.error('Error fetching Facebook posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}