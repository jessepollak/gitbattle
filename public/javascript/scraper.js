//Yes, I do understand that I am exposing private credentials. They are not linked
// to a real account and can be deactivated at any time; therefore, I ask that
// you don't try and abuse them. Thanks!
IDENTITY = '?client_id=ac46392bf2f66282bc31&client_secret=563c93bb3e0c4d2b2d677c9acedf33a6f97bcd00'
GITHUB = 'https://api.github.com/';

var Scraper = function() {  
    this.getUserData = function(USER, $el, user_def) {
        // if (typeof Storage !== 'undefined' && localStorage[USER]) {
        //     var user = JSON.parse(localStorage.getItem(USER));
        //     if(((new Date()) - Date.parse(user.processed)) / 1000 < 60*60*24) {
        //         user_def.resolve(user);
        //         return;
        //     }
        // } 

        var forks = 0,
            stars = 0,
            subscribers = 0,
            createdAt,
            userData,
            followers = 0,
            commits = 0,
            repos = 0,
            orgs = 0,
            gists = 0,
            elChild = $el.find('.columns');
        var promises = [];
        var defer = $.Deferred();
        promises.push();
        promises.push($.get(GITHUB + 'users/' + USER + IDENTITY, function(data) {
            data = data.data;
            followers = data.followers;
            console.log(followers, USER);
            createdAt = data.created_at;
            userData = data;
        }, 'jsonp'));
        var promise_count = 0;

        promises.push($.Deferred(function (def) {
            $.get(GITHUB + 'users/' + USER + '/orgs' + IDENTITY+ '&per_page=100',
                function(data) {
                    data = data.data;
                    orgs += data.length;
                    def.resolve();
                },
                'jsonp')
            })
        );

        promises.push($.Deferred(function (def) {
            $.get(GITHUB + 'users/' + USER + '/gists' + IDENTITY + '&per_page=100',
                function(data) {
                    data = data.data;
                    gists += data.length;
                    def.resolve();
                },
                'jsonp')
            })
        );

        $el.show();
        promises.push($.Deferred(
            function(def) { 
                getRepoData(GITHUB + 'users/' + USER + '/repos' + IDENTITY + '&per_page=100', def);
            }
        ));

        function getRepoData(url, def) {
            $.get(
                url, 
                function(resp, status, obj) {
                    data = resp.data;
                    for(var i = 0; i < data.length; i++) {
                        var e = data[i];
                        if(e.size > 0) {
                            repos++;
                            if(!e.fork && e.forks) {
                                forks += e.forks;
                            }
                            if (e.watchers) stars += e.watchers;
                            elChild.append('<h5 data-name="' + e.name + '">' 
                                + e.name + '</h5>');
                            promises.push($.Deferred(function (def) {
                                getCommitCount(e.name, def);
                            }));
                        }
                    }

                    console.log(resp.meta, USER)
                    var next= hasNext(resp.meta.Link);

                    if(next.hasNext) {
                        getRepoData(next.nextLink, def);
                    } else {            
                        def.resolve();
                        $.when.apply(null, promises).done(function(args1, args2) {
                            user_def.resolve({
                                age: createdAt,
                                followers: followers,
                                forks: forks,
                                stars: stars,
                                commits: commits,
                                repositories: repos,
                                organiations: orgs,
                                gists: gists
                            });
                        });
                    }      
                }, 
                'jsonp');
        }

        function getNumberCount(url, def) {
            var count = 0;
            var promise;
            $.ajax({
                url: url,
                async: false,
                success: function(resp, status, obj) {
                    linkHeader = obj.getResponseHeader('Link');
                    if(linkHeader) {
                        var last = hasLast(linkHeader);
                        if(last.hasLast) {
                            count += 100*(last.lastNumber - 1);
                            $.ajax({
                                url: last.lastLink,
                                async: false,
                                success: function(resp) {
                                    count += resp.length;
                                }
                            });
                        } 
                    } 
                }
            });

            if(def) {
                def.resolve();
            }
            return count;
        }

        function getCommitCount(name, def) {
            var url = GITHUB + 'repos/' + USER + '/' + name + '/contributors' + IDENTITY;
            $.get(url,
                function(resp, status, obj) {
                    if(resp.data) {
                        var user = false;
                        if(resp.data.message === "Git Repository is empty.") {
                            def.resolve();
                            return;
                        }

                        resp.data.forEach(function(c) {
                            if(c.login === USER) {
                                commits += c.contributions;
                                user = true;
                            }
                        });

                        if(user) {
                            if(def && def.state() == 'pending') {
                                elChild.find('h5[data-name="' + name + '"]').remove();
                                def.resolve();
                            }
                        } else {
                            linkHeader = resp.meta.Link;
                            if(linkHeader) {
                                var next = hasNext(linkHeader);
                                if(next.hasNext) {
                                    getCommitCount(next.nextLink, name, def);
                                } else {
                                    if(def && def.state() == 'pending') {
                                        elChild.find('h5[data-name="' + name + '"]').remove();
                                        def.resolve();
                                    }
                                }
                            }  else {
                                if(def && def.state() == 'pending') {
                                    elChild.find('h5[data-name="' + name + '"]').remove();
                                    def.resolve();
                                }
                            }
                        }
                    }
                },
                'jsonp'
            );
        }

        function hasLast(linkHeader) {
            var last = false;
            var lastNumber;
            linkHeader.split(',').forEach(function(e) {
                var linkParts = e.split(';');
                var verb = linkParts[1].match(/rel=\"(.*)\"/)[1];
                if(verb == 'last') {
                    last = true;
                    lastNumber = parseInt(linkParts[0].match(/page=(.*)&/)[1]);
                    lastLink = linkParts[0].match(/\<(.*)\>/)[1];
                }
            });
            return {
                hasLast: last,
                lastNumber: lastNumber,
                lastLink: lastLink
            }
        }

        function hasNext(linkHeader) {
            var next = false;
            var nextLink;
            if(linkHeader) {
                linkHeader.forEach(function(e) {
                    var verb = e[1].rel;
                    if(verb == 'next') {
                        next = true;
                        nextLink = e[0];
                    }
                });
            }
            return {
                hasNext: next,
                nextLink: nextLink
            }
        }
    }
}