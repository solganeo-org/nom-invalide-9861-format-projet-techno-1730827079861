const { notifySlack } = require('./notificationHandlers');
const { logEvent } = require('../utils/logger');
const { triggerCICD } = require('../utils/cicd');
const config = require('../config/config');

module.exports.handlePush = async (payload) => {
    try {
        const branch = payload.ref.replace('refs/heads/', '');
        const commits = payload.commits;
        const repository = payload.repository.full_name;

        console.log(`Handling push event for branch: ${branch} in repository: ${repository}`);

        // Log the event
        await logEvent('push', payload);
        console.log('Event logged successfully for push.');

        // Check for sensitive file changes and notify if necessary
        const sensitiveFiles = ['.env', 'config.json', 'secrets.yaml', 'credentials.json'];
        const sensitiveChanges = commits.some(commit =>
            commit.added.concat(commit.modified).some(file => sensitiveFiles.includes(file))
        );

        if (sensitiveChanges) {
            console.log('Sensitive changes detected, notifying Slack...');
            await notifySlack(`🚨 Sensitive changes detected on branch ${branch} in ${repository} by ${payload.pusher.name}`);
            console.log('Slack notification sent for sensitive changes.');
        }

        // Trigger CI/CD if applicable
        console.log(`Triggering CI/CD for branch: ${branch}...`);
        await triggerCICD({
            repository,
            branch,
            commit: payload.after,
            author: payload.pusher.name
        });
        console.log('CI/CD triggered successfully.');

    } catch (error) {
        console.error('Error handling push event:', error);
        throw error;
    }
};

module.exports.handlePullRequest = async (payload) => {
    try {
        const { action, pull_request, repository } = payload;
        const prDetails = {
            number: pull_request.number,
            title: pull_request.title,
            base: pull_request.base.ref,
            head: pull_request.head.ref,
            author: pull_request.user.login,
            repository: repository.full_name
        };

        console.log(`Handling pull request event: ${action} for PR #${prDetails.number} in repository: ${prDetails.repository}`);

        // Log the event
        await logEvent('pull_request', payload);
        console.log('Event logged successfully for pull request.');

        switch (action) {
            case 'opened':
            case 'reopened':
                console.log(`New or reopened PR detected, notifying Slack...`);
                await notifySlack(`📝 New PR #${prDetails.number}: ${prDetails.title} in ${prDetails.repository}`);
                console.log('Slack notification sent for new/reopened PR.');
                break;
            case 'closed':
                if (pull_request.merged) {
                    console.log(`PR #${prDetails.number} merged, notifying Slack...`);
                    await notifySlack(`✅ PR #${prDetails.number} merged in ${prDetails.repository}`);
                    console.log('Slack notification sent for merged PR.');
                }
                break;
            default:
                console.log(`Unhandled pull request action: ${action}`);
        }

    } catch (error) {
        console.error('Error handling pull request event:', error);
        throw error;
    }
};

module.exports.handleIssueComment = async (payload) => {
    try {
        const { action, comment, issue, repository } = payload;

        console.log(`Handling issue comment event: ${action} on issue #${issue.number} in repository: ${repository.full_name}`);

        if (action === 'created') {
            // Log the event
            await logEvent('issue_comment', payload);
            console.log('Event logged successfully for issue comment.');
            
            await notifySlack(`💬 New comment on issue #${issue.number} in ${repository.full_name}: "${comment.body}" by ${comment.user.login}`);
            console.log('Slack notification sent for new issue comment.');
        }

    } catch (error) {
        console.error('Error handling issue comment event:', error);
        throw error;
    }
};

module.exports.handleSecurityAdvisory = async (payload) => {
    try {
        const { action, security_advisory, repository } = payload;

        console.log(`Handling security advisory event: ${action} in repository: ${repository.full_name}`);

        if (action === 'published') {
            await logEvent('security_advisory', payload);
            console.log('Event logged successfully for security advisory.');
            
            await notifySlack(`🚨 Security advisory published in ${repository.full_name}: ${security_advisory.summary}`);
            console.log('Slack notification sent for published security advisory.');
        }

    } catch (error) {
        console.error('Error handling security advisory event:', error);
        throw error;
    }
};

module.exports.handleRepositoryVulnerabilityAlert = async (payload) => {
    try {
        const { action, alert, repository } = payload;

        console.log(`Handling repository vulnerability alert: ${action} in repository: ${repository.full_name}`);

        if (action === 'created') {
            await logEvent('repository_vulnerability_alert', payload);
            console.log('Event logged successfully for vulnerability alert.');
            
            await notifySlack(`🔒 New vulnerability alert in ${repository.full_name} for ${alert.package_name}`);
            console.log('Slack notification sent for vulnerability alert.');
        }

    } catch (error) {
        console.error('Error handling repository vulnerability alert event:', error);
        throw error;
    }
};